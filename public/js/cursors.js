// @ts-check
/**
 * phase2-build5: pure seams for live cursors + participant colour.
 *
 * Everything here is side-effect-free and shared by BOTH ends:
 *   - the server uses PALETTE/pickColourIndex to assign each connection a
 *     collision-free colour (R3),
 *   - the client uses paletteColour to paint avatars + cursors, the
 *     to/fromBoardFraction pair to map a pointer to a scroll-independent board
 *     fraction and back, and reconcileCursors to drop cursors whose participant
 *     has gone.
 *
 * No DOM, no socket, no state — so it unit-tests cleanly and imports safely on
 * the server (the server already imports public/js modules: store, plan-io, ids).
 */

/**
 * A small fixed palette of saturated mid-dark hues. Chosen so WHITE text reads on
 * every one (no runtime contrast maths). Amber/red are reserved for the capacity
 * signal (R2), so they are deliberately excluded here.
 * @type {readonly string[]}
 */
export const PALETTE = [
  "#2563eb", // blue
  "#7c3aed", // violet
  "#0d9488", // teal
  "#db2777", // pink
  "#4f46e5", // indigo
  "#0369a1", // sky-dark
  "#9333ea", // purple
  "#15803d", // green
];

/**
 * The hex for a palette index, wrapping mod length so any integer is valid.
 * @param {number} index
 * @returns {string}
 */
export function paletteColour(index) {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

/**
 * The lowest palette index not currently in use, so a leaver's colour is reused
 * before a new one (R3). Wraps to a valid index once every slot is taken (only
 * possible with more concurrent participants than palette colours).
 * @param {number[]} usedIndices indices held by the room's connected sockets
 * @param {number} paletteSize
 * @returns {number}
 */
export function pickColourIndex(usedIndices, paletteSize) {
  const used = new Set(usedIndices);
  for (let i = 0; i < paletteSize; i++) {
    if (!used.has(i)) return i;
  }
  // Every colour in use: wrap by count so we still hand back a valid index.
  return usedIndices.length % paletteSize;
}

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ left: number, top: number, width: number, height: number }} BoardMetrics
 *   left/top: the board's CURRENT viewport position (getBoundingClientRect).
 *   width/height: the board's full content box.
 */

/**
 * A viewport point -> a board-content fraction in [0,1] (outside the board if
 * <0 or >1). Because left/top come from getBoundingClientRect they already move
 * with the page scroll, so the difference (point - left) is scroll-invariant and
 * NO separate scroll term is needed — adding window.scrollX/Y here would double-
 * count the scroll (build-5 coordinate ruling).
 * @param {Point} point
 * @param {BoardMetrics} m
 * @returns {Point}
 */
export function toBoardFraction(point, m) {
  return { x: (point.x - m.left) / m.width, y: (point.y - m.top) / m.height };
}

/**
 * The exact inverse of toBoardFraction against the SAME metrics shape: a fraction
 * -> a viewport point. The receiver passes ITS OWN board metrics, so the shared
 * fraction lands on the same board cell regardless of either viewer's scroll.
 * @param {Point} frac
 * @param {BoardMetrics} m
 * @returns {Point}
 */
export function fromBoardFraction(frac, m) {
  return { x: frac.x * m.width + m.left, y: frac.y * m.height + m.top };
}

/**
 * The drawn cursor ids that should be removed because their participant is no
 * longer in the presence snapshot (covers a disconnect, which fires only a
 * presence frame and never a `gone` cursor frame).
 * @param {string[]} drawnIds cursor ids currently rendered
 * @param {string[]} presentIds participant ids in the latest presence frame
 * @returns {string[]}
 */
export function reconcileCursors(drawnIds, presentIds) {
  const present = new Set(presentIds);
  return drawnIds.filter((id) => !present.has(id));
}
