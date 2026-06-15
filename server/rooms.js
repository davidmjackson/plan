// @ts-check
/**
 * Phase 2 spike — the authoritative op loop (PROPOSE §7, the load-bearing seam).
 *
 * The whole conflict model lives in applyOp:
 *   1. allow-list the op TYPE (9 wire ops; excluded types never reach reduce),
 *   2. version-gate EDIT_STORY (reject if written against a stale version),
 *   3. apply via plan's EXISTING pure reducer (imported, never re-implemented),
 *   4. guard with plan's EXISTING validatePlan,
 *   5. commit transactionally BEFORE the caller acks/broadcasts.
 *
 * Everything other than the EDIT_STORY gate converges under arrival order +
 * validatePlan; that is the entire net-new rule the spike adds.
 */

import { reduce } from "../public/js/store.js";
import { validatePlan } from "../public/js/plan-io.js";
import { commitRoom } from "./db.js";

/** The 8 ops that serialise safely under arrival order + validatePlan. */
const UNGATED = new Set([
  "ADD_EPIC", "EDIT_EPIC", "DELETE_EPIC",
  "ADD_STORY", "DELETE_STORY", "MOVE_STORY",
  "LINK_DEP", "UNLINK_DEP",
]);
/** The 1 op with whole-record value-semantics, so it gets optimistic version rejection. */
const GATED = new Set(["EDIT_STORY"]);

/** @typedef {{ ok: true, version: number } | { ok: false, reason: string }} OpResult */

/**
 * Apply one op to the room's authoritative document, persisting before return.
 * Mutates `room.doc`/`room.version` on success; leaves them untouched on reject.
 * @param {import("better-sqlite3").Database} db
 * @param {{ id: string, doc: any, version: number }} room
 * @param {{ type: string, payload: any, baseVersion?: number }} op
 * @returns {OpResult}
 */
export function applyOp(db, room, { type, payload, baseVersion }) {
  if (!UNGATED.has(type) && !GATED.has(type)) {
    return { ok: false, reason: `op type not allowed: ${type}` };
  }
  if (GATED.has(type) && baseVersion !== room.version) {
    return { ok: false, reason: `stale: room at version ${room.version}` };
  }

  let next;
  try {
    next = reduce(room.doc, { type, payload });
  } catch (e) {
    return { ok: false, reason: `reduce failed: ${/** @type {Error} */ (e).message}` };
  }

  const v = validatePlan(next);
  if (!v.ok) return { ok: false, reason: v.reason };

  const newVersion = room.version + 1;
  commitRoom(db, room.id, next, newVersion); // durable BEFORE ack/broadcast
  room.doc = next;
  room.version = newVersion;
  return { ok: true, version: newVersion };
}
