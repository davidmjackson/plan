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
 * @param {boolean} [opts.dismissable]  when false, Escape and overlay-click do NOT
 *   close (a blocking gate, e.g. the build4 #3 name prompt); default true
 * @returns {{ close: () => void, attemptClose: () => void, card: HTMLElement }}
 */
export function openModal({ heading, content, footer, isDirty, onClose, dismissable = true }) {
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
    if (e.key === "Escape" && dismissable) {
      e.preventDefault();
      attemptClose();
    }
  }

  overlay.addEventListener("mousedown", (e) => {
    if (dismissable && e.target === overlay) attemptClose();
  });
  document.addEventListener("keydown", onKey);

  const firstField = card.querySelector("input, textarea, select");
  if (firstField instanceof HTMLElement) firstField.focus();

  return { close, attemptClose, card };
}

/**
 * A minimal confirm dialog over the modal shell (phase2-build3 #7). Cancel
 * (ghost) dismisses; the primary button runs onConfirm then closes. Reuses the
 * .modal-footer chrome. For a destructive confirm pass danger:true (red button,
 * Cancel focused so an accidental Enter does not wipe work).
 * @param {Object} opts
 * @param {string} opts.heading
 * @param {string} opts.message
 * @param {string} opts.confirmLabel
 * @param {boolean} [opts.danger]
 * @param {() => void} opts.onConfirm
 */
export function confirmModal({ heading, message, confirmLabel, danger = false, onConfirm }) {
  const content = el("p", "modal-message", message);
  const footer = el("div", "modal-footer");
  const right = el("div", "modal-footer-right");
  const cancel = el("button", "btn btn-ghost", "Cancel");
  const confirm = el("button", "btn " + (danger ? "btn-danger" : "btn-pri"), confirmLabel);
  right.append(cancel, confirm);
  footer.append(right);
  const modal = openModal({ heading, content, footer });
  cancel.addEventListener("click", () => modal.close());
  confirm.addEventListener("click", () => {
    modal.close();
    onConfirm();
  });
  (danger ? cancel : confirm).focus();
}
