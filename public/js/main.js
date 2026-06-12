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
} from "./actions.js";
import { nextMonday } from "./date.js";
import { render } from "./render.js";
import { toggleCollapsed } from "./backlog.js";
import { openCardEditor } from "./card-editor.js";
import { openEpicEditor } from "./epic-editor.js";
import { setupDrag, isDragging } from "./drag.js";

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

/** @returns {import("./store.js").PlanState} */
function loadOrInit() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // Corrupt/blocked storage: fall through to a fresh plan rather than crash.
  }
  return createInitialState(nextMonday(todayISO()));
}

const store = createStore(loadOrInit());

// Autosave: every action persists immediately (cross-cutting rule: refresh
// loses nothing).
store.subscribe((state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

on("ss-start", "change", (v) => v && store.dispatch(setStartDate(v)));
on("ss-duration", "change", (v) => store.dispatch(setDurationMonths(Number(v))));
on("ss-sprint-weeks", "change", (v) => store.dispatch(setSprintWeeks(Number(v))));
on("ss-velocity", "change", (v) => {
  const n = Math.max(1, Math.round(Number(v)));
  if (Number.isFinite(n)) store.dispatch(setVelocity(n));
});
on("ss-buffer", "change", (v) => {
  const n = Math.min(99, Math.max(0, Math.round(Number(v))));
  if (Number.isFinite(n)) store.dispatch(setBufferPct(n));
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

// Board: placed cards open the card editor on click (consistency with the
// backlog). One delegated listener; a click that trails a drag is swallowed.
const boardEl = document.getElementById("board");
boardEl?.addEventListener("click", (e) => {
  if (isDragging()) return;
  const target = e.target instanceof Element ? e.target.closest("[data-act='edit-story']") : null;
  if (target instanceof HTMLElement && target.dataset.story) {
    openCardEditor(store, { storyId: target.dataset.story });
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
store.subscribe((state) => {
  if (!toastEl) return;
  const n = state.lastReturnedStoryIds.length;
  if (n === 0) return;
  toastEl.textContent = `${n} ${n === 1 ? "story" : "stories"} returned to backlog`;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 4000);
});

// First-run affordance: briefly highlight the strip as the edit surface.
const strip = document.getElementById("settings-strip");
if (strip) {
  strip.classList.add("is-fresh");
  setTimeout(() => strip.classList.remove("is-fresh"), 5000);
}
