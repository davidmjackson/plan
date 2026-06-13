// @ts-check
/**
 * Screen 3: the Resume / New-plan prompt (Brief 6, P0 #7 slice 2). The load-time
 * gate that ends silent restore — when a saved board exists it is surfaced here,
 * never restored behind the user's back (Journey 6). A DEDICATED shell, not
 * modal.js: it shares the .modal-* chrome but needs its own close semantics
 * (Escape RESUMES on a valid save; Escape is INERT on an invalid one, so a stray
 * keypress can never drop rescuable bytes) and has no dirty-guard or autofocused
 * field. PURE VIEW over derived data (planSummary, relativeTime); every side
 * effect is a caller-supplied callback that dispatches an existing action or runs
 * the Brief 5 download/import glue. The prompt never touches the store directly.
 */

import { el } from "./dom.js";
import { planSummary } from "./board-selectors.js";
import { relativeTime } from "./date.js";

/**
 * @typedef {Object} ResumePromptDeps
 * @property {() => void} onResume            dispatch loadPlan(savedPlan), then close (VALID only)
 * @property {() => void} onStartNew          dispatch newPlan after the warning, then close
 * @property {() => void} onImport            trigger the hidden #board-file input (prompt stays)
 * @property {() => void} [onDownloadCurrent] escape hatch: download the saved board (VALID only)
 * @property {() => void} [onDownloadRescue]  rescue: download the raw unreadable bytes (INVALID only)
 */

/**
 * Open the prompt for a VALID saved board: the resume card is primary.
 * @param {{ plan: import("./store.js").PlanState, savedAt: string | undefined, nowISO: string }} save
 * @param {ResumePromptDeps} deps
 */
export function openResumePrompt(save, deps) {
  const { plan, savedAt, nowISO } = save;
  const card = el("div", "modal-card rp-card");

  card.append(el("p", "rp-eyebrow micro", "Welcome back"));
  card.append(el("h2", "modal-heading", plan.meta.title?.trim() || "Untitled plan"));
  card.append(el("p", "rp-meta", `Last edited ${relativeTime(savedAt, nowISO)}`));

  const s = planSummary(plan);
  card.append(el("p", "rp-summary mono", summaryLine(s)));

  const actions = el("div", "rp-actions");
  const resume = el("button", "btn rp-resume", "Resume this plan");
  const startNew = el("button", "btn btn-danger", "Start new plan");
  actions.append(resume, startNew);
  card.append(actions);

  // Start-new is destructive, so it expands to a warning + the download-first
  // escape hatch + an explicit confirm before NEW_PLAN is ever dispatched (R3).
  const warn = el("div", "rp-startnew");
  warn.hidden = true;
  warn.append(el("p", "rp-warn", "Starting a new plan replaces your saved board. This can't be undone."));
  const downloadFirst = el("button", "btn btn-ghost btn-sm", "Download current board first (.json)");
  const confirmRow = el("div", "rp-confirm-row");
  const confirmNew = el("button", "btn btn-danger btn-sm", "Start new plan");
  const cancelNew = el("button", "btn btn-ghost btn-sm", "Cancel");
  confirmRow.append(confirmNew, cancelNew);
  warn.append(downloadFirst, confirmRow);
  card.append(warn);

  const importLink = el("button", "rp-import", "Import a board (.json)");
  card.append(importLink);

  const handle = mount(card, /* escapeResumes */ true, () => deps.onResume());

  resume.addEventListener("click", () => {
    handle.close();
    deps.onResume();
  });
  startNew.addEventListener("click", () => {
    warn.hidden = false;
    actions.hidden = true;
    confirmNew.focus();
  });
  cancelNew.addEventListener("click", () => {
    warn.hidden = true;
    actions.hidden = false;
    resume.focus();
  });
  downloadFirst.addEventListener("click", () => deps.onDownloadCurrent?.());
  confirmNew.addEventListener("click", () => {
    handle.close();
    deps.onStartNew();
  });
  importLink.addEventListener("click", () => deps.onImport());

  resume.focus();
  return handle;
}

/**
 * Open the prompt for an INVALID saved board (R5): no Resume; the bytes are
 * surfaced with their reason and a raw-bytes rescue download. Escape is INERT.
 * @param {{ reason: string }} fail
 * @param {ResumePromptDeps} deps
 */
export function openInvalidPrompt(fail, deps) {
  const card = el("div", "modal-card rp-card rp-invalid");

  card.append(el("h2", "modal-heading", "We couldn't read your saved board"));
  card.append(el("p", "rp-reason", fail.reason));
  card.append(
    el("p", "rp-meta", "Your saved data is still here. Download it to keep a copy, then start fresh or import a board."),
  );

  const actions = el("div", "rp-actions");
  const startNew = el("button", "btn btn-danger", "Start new plan");
  const rescue = el("button", "btn btn-ghost", "Download the unreadable save (.json)");
  actions.append(rescue, startNew);
  card.append(actions);

  const importLink = el("button", "rp-import", "Import a board (.json)");
  card.append(importLink);

  // Inert Escape/overlay-click: there is nothing to resume, and a stray dismiss
  // must never drop the rescuable bytes. The only exits are explicit choices.
  const handle = mount(card, /* escapeResumes */ false, () => {});

  rescue.addEventListener("click", () => deps.onDownloadRescue?.());
  startNew.addEventListener("click", () => {
    handle.close();
    deps.onStartNew();
  });
  importLink.addEventListener("click", () => deps.onImport());

  startNew.focus();
  return handle;
}

/** "3 months · 7 sprints · 14 stories · 47 pts placed"
 * @param {{ months: number, sprints: number, stories: number, placedPoints: number }} s */
function summaryLine({ months, sprints, stories, placedPoints }) {
  return [
    `${months} ${months === 1 ? "month" : "months"}`,
    `${sprints} ${sprints === 1 ? "sprint" : "sprints"}`,
    `${stories} ${stories === 1 ? "story" : "stories"}`,
    `${placedPoints} pts placed`,
  ].join(" · ");
}

/**
 * Build the overlay, attach the close behaviour, and return { close }. The
 * dismiss action (Escape / overlay mousedown) runs `onDismiss` then closes when
 * `escapeResumes`; when false it is a true no-op (the invalid-save case).
 * @param {HTMLElement} card
 * @param {boolean} escapeResumes
 * @param {() => void} onDismiss
 */
function mount(card, escapeResumes, onDismiss) {
  const overlay = el("div", "modal-overlay rp-overlay");
  overlay.append(card);
  document.body.append(overlay);

  function close() {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  }

  function dismiss() {
    if (!escapeResumes) return; // inert on the invalid prompt
    close();
    onDismiss();
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
    }
  }

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) dismiss();
  });
  document.addEventListener("keydown", onKey);

  return { close };
}
