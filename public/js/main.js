// @ts-check
/**
 * App bootstrap: build/restore the store, wire the settings-strip controls to
 * dispatch, autosave on every change, and render on every state notification.
 * The view never mutates state — it only dispatches named actions.
 */

import { createStore, createInitialState } from "./store.js";
import {
  setStartDate,
  setDurationMonths,
  setSprintWeeks,
  setVelocity,
  setBufferPct,
  setPlanTitle,
  loadPlan,
  newPlan,
} from "./actions.js";
import { nextMonday } from "./date.js";
import { validatePlan, migratePlan, exportPlan, extractPlan } from "./plan-io.js";
import { reportModel, toMarkdown, toHtml, toCsv } from "./report.js";
import { render } from "./render.js";
import { toggleCollapsed } from "./backlog.js";
import { openCardEditor } from "./card-editor.js";
import { openEpicEditor } from "./epic-editor.js";
import { setupDrag, isDragging } from "./drag.js";
import { dismissBanner, clearDismissedBanners } from "./banner.js";
import { openResumePrompt, openInvalidPrompt } from "./resume-prompt.js";

const STORAGE_KEY = "sprintplan:board";

/**
 * Today's local calendar date as ISO. This is the ONE place we read the system
 * clock; all downstream calendar maths is pure string arithmetic (see date.js).
 * @returns {string}
 */
function todayISO() {
  const now = new Date();
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The current instant as an ISO timestamp. The second (and last) place we read
 * the system clock, used only to stamp the persistence/export envelopes (savedAt,
 * exportedAt). Like todayISO, this is a boundary read: the timestamp never enters
 * store state and never passes through an action — the reducer stays time-free.
 * @returns {string}
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * lastReturnedStoryIds is transient toast-trigger state, meaningless across a
 * load boundary (R6). Normalise it to [] on every restored/imported plan so no
 * stale "returned to backlog" toast fires on load.
 * @param {import("./store.js").PlanState} plan
 */
function normalise(plan) {
  return { ...plan, lastReturnedStoryIds: [] };
}

/** A fresh default plan anchored at the next working Monday (G1). */
function freshPlan() {
  return createInitialState(nextMonday(todayISO()));
}

/**
 * @typedef {{ kind: "none" }
 *   | { kind: "valid", plan: import("./store.js").PlanState, savedAt: string | undefined }
 *   | { kind: "invalid", reason: string, raw: string }} SaveVerdict
 */

/**
 * CLASSIFY the autosaved board without seeding anything (Brief 6, R2). The store
 * always boots fresh; this only inspects the stored bytes so the load-time prompt
 * knows what to offer. Three outcomes: none (first run); valid (resumable plan +
 * its savedAt); invalid (a parseable-or-not save that fails the pipeline — we
 * keep the RAW string and the human reason so the prompt can surface and rescue
 * it, R5). Crucially this READS but never WRITES, so the bad bytes stay intact
 * under the prompt until the user acts — that is what makes the R5 rescue real.
 * @returns {SaveVerdict}
 */
function classifySave() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { kind: "none" }; // storage blocked: treat as a clean first run
  }
  if (raw == null) return { kind: "none" };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "invalid", reason: "the saved data isn't valid JSON", raw };
  }
  const ext = extractPlan(parsed, "restore");
  if (!ext.ok) return { kind: "invalid", reason: ext.reason, raw };
  const mig = migratePlan(ext.plan);
  if (!mig.ok) return { kind: "invalid", reason: mig.reason, raw };
  const val = validatePlan(mig.plan);
  if (!val.ok) return { kind: "invalid", reason: val.reason, raw };

  const savedAt = parsed && typeof parsed === "object" ? parsed.savedAt : undefined;
  return { kind: "valid", plan: normalise(val.plan), savedAt };
}

// The store ALWAYS boots fresh (R2): a saved board is restored only by an
// explicit, prompted loadPlan dispatch, never substituted at boot. Two safety
// properties fall out — the saved board never renders under the prompt (no
// last-quarter flash on a shared screen), and autosave (dispatch-only) cannot
// overwrite the saved bytes until the user chooses (the R5 rescue stays open).
const store = createStore(freshPlan());

// Autosave: every action persists immediately (cross-cutting rule: refresh
// loses nothing). Persist the { savedAt, plan } envelope (R7) — savedAt is
// stamped HERE, at the serialize boundary, never in store state. Brief 6's
// resume card reads savedAt for free; this brief writes it but renders nothing.
store.subscribe((state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: nowISO(), plan: state }));
  } catch {
    // Storage full/blocked — non-fatal for the in-memory session.
  }
});

// Render on every change, then (re)wire dragula over the fresh DOM. render()
// rebuilds the board/backlog via replaceChildren, so the drake must be rebuilt
// after each paint. Run once now for the initial paint.
function paint(/** @type {import("./store.js").PlanState} */ state) {
  render(state);
  setupDrag(store);
}
store.subscribe(paint);
paint(store.getState());

// --- Wire the settings strip ------------------------------------------------

/** @param {string} id @param {string} evt @param {(value: string) => void} handler */
function on(id, evt, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(evt, () => handler(/** @type {HTMLInputElement} */ (el).value));
}

// Settings changes are the only paths that regenerate the board. They clear the
// dismissed-banner set first: capacity just changed, so every still-over banner
// must re-arm (this closes the stale-index hole — a re-grown sprint must not
// inherit an old dismissal). View state never enters the store; this just clears
// a view-local Set before the regenerating dispatch. MOVE_STORY and others do
// NOT clear it, preserving the per-session dismiss promise.
/** @param {{ type: string, payload?: any }} action */
function dispatchSettings(action) {
  clearDismissedBanners();
  store.dispatch(action);
}

on("ss-start", "change", (v) => v && dispatchSettings(setStartDate(v)));
on("ss-duration", "change", (v) => dispatchSettings(setDurationMonths(Number(v))));
on("ss-sprint-weeks", "change", (v) => dispatchSettings(setSprintWeeks(Number(v))));
on("ss-velocity", "change", (v) => {
  const n = Math.max(1, Math.round(Number(v)));
  if (Number.isFinite(n)) dispatchSettings(setVelocity(n));
});
on("ss-buffer", "change", (v) => {
  const n = Math.min(99, Math.max(0, Math.round(Number(v))));
  if (Number.isFinite(n)) dispatchSettings(setBufferPct(n));
});

// Backlog panel: one delegated listener; rendered nodes carry data-act.
const backlogEl = document.getElementById("backlog");
backlogEl?.addEventListener("click", (e) => {
  if (isDragging()) return; // swallow the click that trails a drag
  const target = e.target instanceof Element ? e.target.closest("[data-act]") : null;
  if (!(target instanceof HTMLElement)) return;
  switch (target.dataset.act) {
    case "add-epic":
      openEpicEditor(store, null);
      break;
    case "edit-epic":
      openEpicEditor(store, target.dataset.epic ?? null);
      break;
    case "add-story":
      openCardEditor(store, { epicId: target.dataset.epic ?? null });
      break;
    case "edit-story":
      openCardEditor(store, { storyId: target.dataset.story });
      break;
    case "toggle-epic":
      if (target.dataset.epic) {
        toggleCollapsed(target.dataset.epic);
        paint(store.getState()); // collapse is view state; re-render + re-wire drag
      }
      break;
  }
});

// Board: one delegated listener. Placed cards open the card editor; the honesty
// banner's × dismisses that sprint's banner for the session. A click that trails
// a drag is swallowed. The dismiss button is a sibling of the sprint body (not
// inside a placed card), so it can never match the edit-story branch.
const boardEl = document.getElementById("board");
boardEl?.addEventListener("click", (e) => {
  if (isDragging()) return;
  const target = e.target instanceof Element ? e.target.closest("[data-act]") : null;
  if (!(target instanceof HTMLElement)) return;
  switch (target.dataset.act) {
    case "edit-story":
      if (target.dataset.story) openCardEditor(store, { storyId: target.dataset.story });
      break;
    case "dismiss-banner":
      dismissBanner(Number(target.dataset.sprintIndex));
      paint(store.getState()); // dismiss is view state; re-render + re-wire drag
      break;
  }
});

// Plan title: editable h1 in the band (G6). Commit on blur.
const titleEl = document.getElementById("plan-title");
if (titleEl) {
  titleEl.addEventListener("blur", () => {
    store.dispatch(setPlanTitle((titleEl.textContent ?? "").trim()));
  });
}

// --- Returned-to-backlog toast (G3) ----------------------------------------

const toastEl = document.getElementById("toast");
/** @type {ReturnType<typeof setTimeout> | undefined} */
let toastTimer;
/** Show a transient, non-blocking message (G3 toast + board-file errors). */
function flash(/** @type {string} */ text) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 4000);
}
store.subscribe((state) => {
  const n = state.lastReturnedStoryIds.length;
  if (n === 0) return;
  flash(`${n} ${n === 1 ? "story" : "stories"} returned to backlog`);
});

// --- Board file I/O (Screen 5 ruling G8: the top-bar Save / load control) ---
// Board FILE only — never report export (P0 #6), never a New-plan button. The
// pure core (plan-io.js) does validate/migrate/extract/export; this is the thin
// browser glue (Blob download, file read) the brief keeps out of the unit net.

/** Filename-safe slug of the plan title, or a fallback. */
function slugify(/** @type {string | null} */ title) {
  return (title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled-plan";
}

/** Trigger a browser download of `text` as `filename`. The thin glue the board
 * export, the invalid-save rescue, AND the report export (Brief 9) share; `mime`
 * defaults to JSON for the board callers, the report passes its own type. */
function downloadText(
  /** @type {string} */ text,
  /** @type {string} */ filename,
  /** @type {string} */ mime = "application/json",
) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download a plan as a self-identifying board .json (R2 header). Reused by the
 * top-bar Download control AND the Start-new escape hatch (on the SAVED plan). */
function downloadBoard(/** @type {import("./store.js").PlanState} */ state) {
  const payload = exportPlan(state, nowISO());
  downloadText(JSON.stringify(payload, null, 2), `${slugify(state.meta.title)}-${todayISO()}.json`);
}

/** Download the raw, verbatim stored bytes of an unreadable save (R5 rescue).
 * Verbatim, NOT reserialised: a structurally-broken save is handed back exactly
 * as stored so nothing recoverable is lost to reformatting. */
function downloadRaw(/** @type {string} */ text) {
  downloadText(text, `unreadable-board-${todayISO()}.json`);
}

document.getElementById("tb-export")?.addEventListener("click", () => downloadBoard(store.getState()));

// --- Report export (Brief 9, P0 #6, ruling G8): its OWN control, distinct from
// the board .json Save/Import above. A PURE READ (R2) — it runs reportModel over
// the live state, renders the chosen format, and downloads it. It dispatches
// nothing and never touches the sprintplan:board autosave envelope.
const REPORT_FORMATS = {
  md: { render: toMarkdown, ext: "md", mime: "text/markdown" },
  html: { render: toHtml, ext: "html", mime: "text/html" },
  csv: { render: toCsv, ext: "csv", mime: "text/csv" },
};

function exportReport(/** @type {string | null} */ format) {
  const spec = format ? REPORT_FORMATS[/** @type {keyof typeof REPORT_FORMATS} */ (format)] : undefined;
  if (!spec) return;
  const state = store.getState();
  const text = spec.render(reportModel(state));
  downloadText(text, `${slugify(state.meta.title)}-summary-${todayISO()}.${spec.ext}`, spec.mime);
}

document.querySelectorAll("[data-export]").forEach((btn) =>
  btn.addEventListener("click", () => {
    exportReport(btn.getAttribute("data-export"));
    btn.closest("details")?.removeAttribute("open"); // collapse the menu after a pick
  }),
);

/** @type {{ close: () => void } | null} The open load-time prompt, if any. A
 * successful import closes it; mid-session (no prompt) it stays null. */
let activePrompt = null;

// Import a board file: ATOMIC (R3) — validate fully before any dispatch, so a
// bad or foreign file leaves the current board exactly as it was.
const fileInput = /** @type {HTMLInputElement | null} */ (document.getElementById("board-file"));
document.getElementById("tb-import")?.addEventListener("click", () => fileInput?.click());
fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  fileInput.value = ""; // reset first, so the same file can be re-picked later
  if (!file) return;
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return flash("Import failed: that file isn't valid JSON.");
  }
  const ext = extractPlan(parsed, "file");
  if (!ext.ok) return flash(`Import failed: ${ext.reason}.`);
  const mig = migratePlan(ext.plan);
  if (!mig.ok) return flash(`Import failed: ${mig.reason}.`);
  const val = validatePlan(mig.plan);
  if (!val.ok) return flash(`Import failed: ${val.reason}.`);
  store.dispatch(loadPlan(normalise(val.plan))); // autosaves + repaints for free
  activePrompt?.close(); // a load-time import closes the prompt; mid-session it is null
  activePrompt = null;
  flash("Board imported.");
});

// --- Load-time gate: the Resume / New-plan prompt (Screen 3, R1/R2) ---------
// The store already booted fresh and painted an empty board. Now classify the
// saved bytes and, only if a save exists, open the prompt OVER that fresh board.
// Nothing has dispatched yet, so the saved bytes are still intact for rescue.

const verdict = classifySave();

if (verdict.kind === "valid") {
  activePrompt = openResumePrompt(
    { plan: verdict.plan, savedAt: verdict.savedAt, nowISO: nowISO() },
    {
      onResume: () => store.dispatch(loadPlan(verdict.plan)), // already normalised
      onStartNew: () => store.dispatch(newPlan(nextMonday(todayISO()))),
      onImport: () => fileInput?.click(),
      onDownloadCurrent: () => downloadBoard(verdict.plan),
    },
  );
} else if (verdict.kind === "invalid") {
  activePrompt = openInvalidPrompt(
    { reason: verdict.reason },
    {
      onResume: () => {}, // no resume on an invalid save
      onStartNew: () => store.dispatch(newPlan(nextMonday(todayISO()))),
      onImport: () => fileInput?.click(),
      onDownloadRescue: () => downloadRaw(verdict.raw),
    },
  );
} else {
  // First run only (no save): briefly highlight the strip as the edit surface.
  const strip = document.getElementById("settings-strip");
  if (strip) {
    strip.classList.add("is-fresh");
    setTimeout(() => strip.classList.remove("is-fresh"), 5000);
  }
}
