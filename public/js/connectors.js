// @ts-check
/**
 * The board's dependency drawing layer (Brief 8, slice 2). A PURE VIEW over the
 * slice-1 model: it consumes connectorsToDraw / isViolation (via the carried
 * flag) and only measures pixels. It dispatches nothing and never touches deps,
 * the store, or the schema (R1/R2).
 *
 * One <svg> overlay is appended as the LAST child of #board (which is set
 * position: relative). renderBoard tears the board down with replaceChildren on
 * every render, so the overlay is recreated each draw and endpoints are
 * re-queried by [data-story] after layout — never cached across renders. The
 * page (not the board) scrolls and there is no zoom, so an SVG sized to the
 * board's content box and measured in board-local coordinates is scroll-correct
 * for free.
 *
 * Hover/select state lives module-level (R6), like backlog.js's collapsed Set:
 * the hovered story id drives which cross-sprint connectors show, and a re-render
 * must neither lose nor leak it. Tethers (same-sprint pairs) are always visible;
 * cross-sprint connectors show only while one of their cards is hovered (R4).
 */

import { connectorsToDraw } from "./dep-selectors.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** @type {SVGSVGElement | null} the live overlay; recreated whenever the board DOM is rebuilt */
let svg = null;
/** @type {string | null} the hovered story id (view state, never dispatched, R6) */
let hoveredStoryId = null;
/** @type {import("./store.js").PlanState | null} last state drawn, so a hover redraw needs no new dispatch */
let lastState = null;
/** delegated hover listener attached once — #board itself survives replaceChildren */
let wired = false;
/** True while a drag is in flight (R7): the layer is hidden and hover is inert,
 * so a mouseover crossing a card mid-drag cannot re-show a stale connector. A
 * full render (drawConnectors) or the dragend redraw clears it. */
let suppressed = false;

/** The right-gutter bow, in px: cards sit ~24px inside the sprint's right padding. */
const TETHER_BOW = 16;
const CONNECTOR_BOW = 22;

function boardEl() {
  return document.getElementById("board");
}

/**
 * Draw (or redraw) the overlay as the last step of renderBoard, after every
 * sprint and card is in the DOM. Stores the state so a later hover redraw can
 * recompute geometry without a dispatch.
 * @param {import("./store.js").PlanState} state
 */
export function drawConnectors(state) {
  lastState = state;
  suppressed = false; // a full render is a settled state — always show
  const board = boardEl();
  if (!board) return;
  wireHover(board);
  paint();
}

/** Hide the overlay for the duration of a drag (R7): a connector to a mid-drag
 * card would be stale. Any subsequent paint() (the drop's render, or dragend's
 * redraw) makes it visible again. */
export function hideConnectors() {
  suppressed = true;
  if (svg) svg.style.display = "none";
}

/** Redraw against the current DOM — used on dragend so a CANCELLED drag (which
 * fires no dispatch and no render) still restores the layer; a real drop also
 * triggers a render that recreates the overlay, so this is harmless there. */
export function redrawConnectors() {
  suppressed = false;
  paint();
}

/** Attach the delegated hover listener once. #board persists across renders
 * (replaceChildren replaces its children, not the element), so this binds a
 * single listener for the app's life. */
function wireHover(/** @type {HTMLElement} */ board) {
  if (wired) return;
  wired = true;
  board.addEventListener("mouseover", (e) => {
    if (suppressed) return; // inert mid-drag (R7): no re-show on a crossed card
    const t = e.target;
    const card = t instanceof Element ? t.closest("[data-story]") : null;
    const id = card instanceof HTMLElement ? card.dataset.story ?? null : null;
    if (id !== hoveredStoryId) {
      hoveredStoryId = id;
      paint();
    }
  });
  // mouseleave (bound to the board, does not bubble) fires once when the pointer
  // exits the board entirely — clears a connector left dangling on exit.
  board.addEventListener("mouseleave", () => {
    if (suppressed) return;
    if (hoveredStoryId !== null) {
      hoveredStoryId = null;
      paint();
    }
  });
}

/** Build the shared arrowhead marker; fill: context-stroke makes the head follow
 * each path's stroke (neutral or violation-red) with no per-path marker. */
function buildDefs() {
  const defs = document.createElementNS(SVG_NS, "defs");
  const marker = document.createElementNS(SVG_NS, "marker");
  marker.setAttribute("id", "dep-arrow");
  marker.setAttribute("viewBox", "0 0 8 8");
  marker.setAttribute("refX", "7");
  marker.setAttribute("refY", "4");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto");
  const tip = document.createElementNS(SVG_NS, "path");
  tip.setAttribute("d", "M0,0 L8,4 L0,8 z");
  tip.setAttribute("fill", "context-stroke");
  marker.appendChild(tip);
  defs.appendChild(marker);
  return defs;
}

/**
 * A card's board-local rect, or null if it is not currently on the board (e.g.
 * a backlog story — connectorsToDraw already excludes those, this is a guard).
 * Re-queried every paint; element references are never cached across renders.
 * @returns {{ right: number, midY: number } | null}
 */
function cardRect(/** @type {HTMLElement} */ board, /** @type {string} */ storyId, /** @type {DOMRect} */ boardRect) {
  const card = board.querySelector(`[data-story="${storyId}"]`);
  if (!card) return null;
  const r = card.getBoundingClientRect();
  return { right: r.right - boardRect.left, midY: (r.top + r.bottom) / 2 - boardRect.top };
}

/** A right-bowed cubic from the blocker's right edge to the blocked's right edge.
 * The arrowhead sits at the path end (the blocked/dependent card). */
function curvePath(
  /** @type {{right:number,midY:number}} */ from,
  /** @type {{right:number,midY:number}} */ to,
  /** @type {number} */ bow,
  /** @type {number} */ maxX,
  /** @type {string} */ className,
) {
  const x1 = from.right;
  const y1 = from.midY;
  const x2 = to.right;
  const y2 = to.midY;
  const c1 = Math.min(x1 + bow, maxX);
  const c2 = Math.min(x2 + bow, maxX);
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`);
  path.setAttribute("class", className);
  path.setAttribute("marker-end", "url(#dep-arrow)");
  return path;
}

/** Rebuild the overlay's contents from lastState + hoveredStoryId. Cheap enough
 * to run on every render and every hover at this scale (≤12 sprints, tens of
 * cards); never rebuilds the board (R-subtle-call). */
function paint() {
  const board = boardEl();
  if (!board || !lastState) return;

  // Recreate the overlay if the board DOM was torn down since last paint.
  if (!svg || !board.contains(svg)) {
    svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG_NS, "svg"));
    svg.setAttribute("class", "dep-layer");
    board.appendChild(svg); // last child, drawn over the cards
  }
  svg.style.display = "";

  const bw = board.scrollWidth;
  const bh = board.scrollHeight;
  svg.setAttribute("width", String(bw));
  svg.setAttribute("height", String(bh));
  svg.setAttribute("viewBox", `0 0 ${bw} ${bh}`);

  const boardRect = board.getBoundingClientRect();
  const maxX = bw - 2; // keep the bow inside the overlay
  const nodes = [buildDefs()];

  for (const c of connectorsToDraw(lastState)) {
    // Cross-sprint connectors are on-demand (R4): only when one endpoint is
    // hovered. Same-sprint tethers are always visible.
    if (c.kind === "connector" && c.blockerId !== hoveredStoryId && c.blockedId !== hoveredStoryId) {
      continue;
    }
    const from = cardRect(board, c.blockerId, boardRect);
    const to = cardRect(board, c.blockedId, boardRect);
    if (!from || !to) continue;

    if (c.kind === "tether") {
      nodes.push(curvePath(from, to, TETHER_BOW, maxX, "dep-line dep-tether"));
    } else {
      const cls = c.violation ? "dep-line dep-connector dep-line--violation" : "dep-line dep-connector";
      nodes.push(curvePath(from, to, CONNECTOR_BOW, maxX, cls));
    }
  }
  svg.replaceChildren(...nodes);
}
