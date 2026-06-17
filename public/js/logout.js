// public/js/logout.js
// @ts-check
/**
 * Phase 3 logout. Pure decision (decideLogout) + button glue (wireLogout).
 *
 * Two exits, branched on whether this browser holds a real suite session (NOT
 * on whether we are in a room): a suite user clears the cookie and returns to
 * the hub dashboard; a guest sees an informational modal, then goes to the
 * suite landing — their identity is already ephemeral (URL-only, wiped on close)
 * and room mode persists nothing locally, so there is no local state to clear.
 *
 * DOM-free at import time: document/fetch/location are touched only in bodies.
 */
import { openModal } from "./modal.js";
import { el } from "./dom.js";
import { dashboardUrl, landingUrl } from "./suite-urls.js";

/**
 * @param {{ hasSuiteSession: boolean }} input
 * @returns {{ kind: "suite"|"guest" }}
 */
export function decideLogout({ hasSuiteSession }) {
  return { kind: hasSuiteSession ? "suite" : "guest" };
}

/** Show the guest "You've logged out" modal; any close routes to `onDone`. */
function showLoggedOutModal(/** @type {() => void} */ onDone) {
  const content = el("div", "modal-body");
  content.append(el("p", "field-hint", "You've been logged out. You'll be taken to the Sprint Suite."));
  const footer = el("div", "modal-footer");
  const right = el("div", "modal-footer-right");
  const ok = el("button", "btn btn-pri", "Go to Sprint Suite");
  ok.setAttribute("type", "button");
  right.append(ok);
  footer.append(right);
  // onClose covers Escape/backdrop too, so every dismissal lands on the suite.
  const modal = openModal({ heading: "Logged out", content, footer, onClose: onDone });
  ok.addEventListener("click", () => modal.close());
}

/**
 * Wire the header Log out button. No-op if the button is absent.
 * @param {{ button: HTMLElement | null, hasSuiteSession: boolean }} deps
 */
export function wireLogout({ button, hasSuiteSession }) {
  if (!button) return;
  button.addEventListener("click", async () => {
    const { kind } = decideLogout({ hasSuiteSession });
    if (kind === "suite") {
      // Clear the plan_session cookie server-side, then go to the dashboard.
      // redirect:"manual" so a 302 from handleLogout doesn't throw cross-origin.
      try { await fetch("/auth/logout", { redirect: "manual" }); } catch { /* best-effort */ }
      location.replace(dashboardUrl());
    } else {
      showLoggedOutModal(() => location.replace(landingUrl()));
    }
  });
}
