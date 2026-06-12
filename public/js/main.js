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
} from "./actions.js";
import { nextMonday } from "./date.js";
import { validatePlan, migratePlan, exportPlan, extractPlan } from "./plan-io.js";
import { render } from "./render.js";
import { toggleCollapsed } from "./backlog.js";
import { openCardEditor } from "./card-editor.js";
import { openEpicEditor } from "./epic-editor.js";
import { setupDrag, isDragging } from "./drag.js";
import { dismissBanner, clearDismissedBanners } from "./banner.js";

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

/**
 * Restore the autosaved board, now VALIDATED. Parse, unwrap (restore leniency:
 * the { savedAt, plan } envelope OR a legacy bare state), migrate, validate. On
 * any structural failure, fall back to a fresh plan exactly as a parse error
 * already does. KNOWN LIMITATION (closed in Brief 6): an invalid autosave is
 * discarded, not recovered — the next action's autosave overwrites it. This
 * brief only stops the crash; the resume prompt gives a bad save a home.
 * @returns {import("./store.js").PlanState}
 */
function loadOrInit() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const ext = extractPlan(JSON.parse(saved), "restore");
      if (ext.ok) {
        const mig = migratePlan(ext.plan);
        if (mig.ok) {
          const val = validatePlan(mig.plan);
          if (val.ok) return normalise(val.plan);
        }
      }
    }
  } catch {
    // Corrupt/blocked storage: fall through to a fresh plan rather than crash.
  }
  return createInitialState(nextMonday(todayISO()));
}

const store = createStore(loadOrInit());

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

// Download the current board as a self-identifying .json (R2 header).
document.getElementById("tb-export")?.addEventListener("click", () => {
  const state = store.getState();
  const payload = exportPlan(state, nowISO());
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(state.meta.title)}-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

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
  flash("Board imported.");
});

// First-run affordance: briefly highlight the strip as the edit surface.
const strip = document.getElementById("settings-strip");
if (strip) {
  strip.classList.add("is-fresh");
  setTimeout(() => strip.classList.remove("is-fresh"), 5000);
}
