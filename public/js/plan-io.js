// @ts-check
/**
 * Plan-level persistence-boundary operations (Brief 5, P0 #7). These are the
 * single safety spine every load path passes through: a foreign file, a dangling
 * id, or an unknown schema version fails HERE, at the boundary, never in the
 * renderer. All four functions are PURE and DOM-free; the Blob/file glue in
 * main.js is thin wiring over this tested core.
 *
 * Failable functions return a discriminated result: { ok: true, plan } or
 * { ok: false, reason } with a human-readable reason naming the first failure.
 */

import { isValidPoints } from "./validate.js";

/** The schema version this build understands. Brief 7 bumps it (see migratePlan). */
const CURRENT_SCHEMA = 1;

/** @param {any} v @returns {boolean} a plain (non-array) object */
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Validate a plan's structure and conservation invariants. Assumes a migrated
 * plan (migratePlan owns the version verdict). Checks at minimum: every
 * top-level key is present and the right kind; every backlog/placed id exists in
 * stories; no id appears in more than one array (conservation, the invariant
 * MOVE_STORY protects, now enforced at the load boundary); every story.epicId is
 * null or an existing epic; every story's points pass the validate.js rule.
 * @param {any} plan
 * @returns {{ ok: true, plan: any } | { ok: false, reason: string }}
 */
export function validatePlan(plan) {
  if (!isObject(plan)) return { ok: false, reason: "plan is not an object" };

  // Top-level keys present and the right kind (names the first failure).
  for (const key of ["meta", "settings", "epics", "stories"]) {
    if (!isObject(plan[key])) return { ok: false, reason: `missing or invalid key: ${key}` };
  }
  for (const key of ["sprints", "backlog"]) {
    if (!Array.isArray(plan[key])) return { ok: false, reason: `missing or invalid key: ${key}` };
  }

  // Conservation: every placed/backlog id exists in stories, and no id appears
  // in more than one array (the invariant MOVE_STORY protects, enforced here at
  // the load boundary).
  const seen = new Set();
  const arrays = [plan.backlog, ...plan.sprints.map((/** @type {any} */ s) => s.placedStoryIds)];
  for (const ids of arrays) {
    if (!Array.isArray(ids)) return { ok: false, reason: "a sprint has invalid placedStoryIds" };
    for (const id of ids) {
      if (!(id in plan.stories)) return { ok: false, reason: `id "${id}" is not a known story` };
      if (seen.has(id)) return { ok: false, reason: `id "${id}" appears in more than one place` };
      seen.add(id);
    }
  }

  // Per-story: epicId is null or an existing epic; points pass the validate.js rule.
  for (const id of Object.keys(plan.stories)) {
    const s = plan.stories[id];
    if (s.epicId !== null && !(s.epicId in plan.epics)) {
      return { ok: false, reason: `story "${id}" references unknown epic "${s.epicId}"` };
    }
    if (!isValidPoints(s.points)) {
      return { ok: false, reason: `story "${id}" has invalid points: ${s.points}` };
    }
  }

  return { ok: true, plan };
}

/**
 * Version-dispatch migration seam (Brief 5 R4). Only schemaVersion 1 exists, so
 * the loop is a no-op today; Brief 7 adds migrators[1] = v1->v2 and bumps
 * CURRENT_SCHEMA, additively. A missing/invalid version, or one NEWER than this
 * build, fails clearly — it never silently loads.
 * @param {any} plan
 * @returns {{ ok: true, plan: any } | { ok: false, reason: string }}
 */
export function migratePlan(plan) {
  const v = plan && plan.meta ? plan.meta.schemaVersion : undefined;
  if (!Number.isInteger(v)) return { ok: false, reason: "missing or invalid schema version" };
  if (v > CURRENT_SCHEMA) return { ok: false, reason: "saved by a newer version of sprintplan" };
  // Seam: Brief 7 adds migrators[1] = v1->v2 and bumps CURRENT_SCHEMA. No-op today.
  let migrated = plan;
  for (let from = v; from < CURRENT_SCHEMA; from++) migrated = MIGRATORS[from](migrated);
  return { ok: true, plan: migrated };
}

/** Version-keyed migrators: migrators[n] upgrades a v(n) plan to v(n+1). Empty today. */
const MIGRATORS = /** @type {Record<number, (plan: any) => any>} */ ({});

/**
 * Build the self-identifying FILE payload (R2): a wrapper that lets a foreign or
 * wrong-app file fail import with a clear "not a sprintplan board". Pure — the
 * caller supplies exportedAt (a boundary clock read), so this stays clock-free.
 * The inner plan's transient lastReturnedStoryIds is reset to [] (R6).
 * @param {any} state
 * @param {string} exportedAt ISO string stamped by the caller at export time
 */
export function exportPlan(state, exportedAt) {
  const plan = { ...state, lastReturnedStoryIds: [] };
  return { app: "sprintplan", schemaVersion: state.meta.schemaVersion, exportedAt, plan };
}

/**
 * Unwrap the inner plan from whichever envelope it arrives in, with leniency by
 * source (the load-bearing safety split, R2/R7): strict on uploaded FILES
 * (require the app header), lenient on our own RESTORE bytes (accept the
 * { savedAt, plan } envelope OR a legacy bare state).
 * @param {any} parsed
 * @param {"file" | "restore"} mode
 * @returns {{ ok: true, plan: any } | { ok: false, reason: string }}
 */
export function extractPlan(parsed, mode) {
  if (!isObject(parsed)) return { ok: false, reason: "file is not a plan object" };
  if (mode === "file") {
    // Strict: the user supplied these bytes, so demand the self-identifying header.
    if (parsed.app !== "sprintplan") return { ok: false, reason: "not a sprintplan board" };
    return { ok: true, plan: parsed.plan };
  }
  // restore: we wrote these bytes. Accept the { savedAt, plan } envelope OR a
  // legacy bare state (pre-Brief-5 autosave). Discarding a valid legacy board
  // would itself be the data loss this brief exists to prevent.
  if ("savedAt" in parsed && "plan" in parsed) return { ok: true, plan: parsed.plan };
  return { ok: true, plan: parsed };
}
