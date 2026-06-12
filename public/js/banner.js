// @ts-check
/**
 * Capacity honesty banner (Brief 4). The slim nudge that renders inside an
 * over-capacity sprint, names the overshoot in points, and is dismissible per
 * sprint per session. Dismiss is VIEW state — a module-local Set of dismissed
 * sprint indexes, exactly like backlog.js's `collapsed`. It is never in the
 * store and never persisted: a dismissal is not plan data, and a reload is a
 * new session that must re-arm every still-over banner.
 *
 * The banner never computes capacity maths of its own — render.js feeds it the
 * already-derived pill state and the overBy figure, so it can never disagree
 * with the pill.
 */

import { el } from "./dom.js";

/** Dismissed sprint indexes — view-only, survives re-render, cleared on reload. @type {Set<number>} */
const dismissed = new Set();

/** @param {number} index */
export function dismissBanner(index) {
  dismissed.add(index);
}

/** @param {number} index */
export function isBannerDismissed(index) {
  return dismissed.has(index);
}

/**
 * Re-arm every banner. Called when a settings change regenerates the board:
 * capacity just changed, so an old dismissal (keyed by index, which can now mean
 * a differently-shaped sprint) must not suppress a real over-commit.
 */
export function clearDismissedBanners() {
  dismissed.clear();
}

/**
 * The banner node: severity wash matched to the pill, the mono overshoot N, the
 * fixed anti-rationalisation copy, and a dismiss control. Only called when the
 * sprint is over (overBy > 0), so `state2` is "amber" or "red", never neutral.
 * @param {number} index sprint index (drives the dismiss control)
 * @param {"amber"|"red"} state2 pill state, matched to the wash
 * @param {number} by overshoot in points
 * @returns {HTMLElement}
 */
export function bannerEl(index, state2, by) {
  const banner = el("div", `sprint-banner is-${state2}`);

  const msg = el("span", "sprint-banner-msg");
  msg.append("Over committed by ");
  msg.append(el("span", "mono", String(by)));
  msg.append(" pts. Relabelling it a stretch goal does not add capacity.");
  banner.append(msg);

  const dismiss = el("button", "banner-dismiss", "×"); // ×
  dismiss.dataset.act = "dismiss-banner";
  dismiss.dataset.sprintIndex = String(index);
  dismiss.setAttribute("aria-label", "Dismiss over-commitment notice for this sprint");
  banner.append(dismiss);

  return banner;
}
