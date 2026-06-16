// @ts-check
/**
 * Modal shell. Owns overlay, Escape/overlay-click close, and the unsaved-changes
 * guard. All modal/dirty state lives here in the VIEW — never in the store (the
 * store only hears committed actions on Save/Delete).
 */

import { el } from "./dom.js";

/**
 * @param {Object} opts
 * @param {string} opts.heading
 * @param {HTMLElement} opts.content   the field body
 * @param {HTMLElement} opts.footer    the action row
 * @param {() => boolean} [opts.isDirty]  guard close when true
 * @param {() => void} [opts.onClose]  teardown run once on every close path
 * @returns {{ close: () => void, attemptClose: () => void, card: HTMLElement }}
 */
export function openModal({ heading, content, footer, isDirty, onClose }) {
  const overlay = el("div", "modal-overlay");
  const card = el("div", "modal-card");
  const h = el("h2", "modal-heading", heading);
  card.append(h, content, footer);
  overlay.append(card);
  document.body.append(overlay);

  /** @type {HTMLElement | null} */
  let guard = null;

  function close() {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    onClose?.(); // R5: teardown (e.g. store unsubscribe) on every close path
  }

  function attemptClose() {
    if (isDirty && isDirty()) {
      showGuard();
    } else {
      close();
    }
  }

  function showGuard() {
    if (guard) return;
    guard = el("div", "modal-guard");
    guard.append(el("span", "modal-guard-msg", "Discard unsaved changes?"));
    const keep = el("button", "btn btn-ghost btn-sm", "Keep editing");
    const discard = el("button", "btn btn-danger btn-sm", "Discard");
    keep.addEventListener("click", () => {
      guard?.remove();
      guard = null;
    });
    discard.addEventListener("click", close);
    guard.append(keep, discard);
    card.append(guard);
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      attemptClose();
    }
  }

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) attemptClose();
  });
  document.addEventListener("keydown", onKey);

  const firstField = card.querySelector("input, textarea, select");
  if (firstField instanceof HTMLElement) firstField.focus();

  return { close, attemptClose, card };
}
