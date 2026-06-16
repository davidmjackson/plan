// @ts-check
/**
 * phase2-build5: the cursor/colour pure seams. All four are side-effect-free and
 * shared by both the server (colour assignment) and the client (cursor placement +
 * reconcile), so they live in one module and are unit-tested here.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PALETTE,
  paletteColour,
  pickColourIndex,
  toBoardFraction,
  fromBoardFraction,
  reconcileCursors,
} from "../public/js/cursors.js";

// --- paletteColour ----------------------------------------------------------
// A fixed palette of saturated mid-dark hues (white text reads on all of them;
// amber/red reserved for capacity, so excluded — R2). Index wraps mod length.

test("paletteColour: index 0 is the first hue; index == length wraps to it", () => {
  assert.equal(paletteColour(0), PALETTE[0]);
  assert.equal(paletteColour(PALETTE.length), PALETTE[0]);
  assert.equal(paletteColour(PALETTE.length + 1), PALETTE[1]);
});

test("paletteColour: every hue is a valid 6-digit hex", () => {
  for (const hue of PALETTE) assert.match(hue, /^#[0-9a-fA-F]{6}$/);
});

// --- pickColourIndex --------------------------------------------------------
// Lowest free index not currently in use; wraps when every index is taken.

test("pickColourIndex: empty used set => 0", () => {
  assert.equal(pickColourIndex([], PALETTE.length), 0);
});

test("pickColourIndex: used {0,1} => 2", () => {
  assert.equal(pickColourIndex([0, 1], PALETTE.length), 2);
});

test("pickColourIndex: used {0,2} => 1 (lowest free, not next-highest)", () => {
  assert.equal(pickColourIndex([0, 2], PALETTE.length), 1);
});

test("pickColourIndex: order/duplicates in the used set don't matter", () => {
  assert.equal(pickColourIndex([2, 0, 2, 1], PALETTE.length), 3);
});

test("pickColourIndex: all indices used => wraps to a valid index", () => {
  const all = PALETTE.map((_, i) => i);
  const idx = pickColourIndex(all, PALETTE.length);
  assert.ok(Number.isInteger(idx) && idx >= 0 && idx < PALETTE.length);
});

// --- toBoardFraction / fromBoardFraction ------------------------------------
// Round-trip between a viewport point and a board-content fraction. metrics =
// { left, top, width, height } is the board's CURRENT viewport box (left/top from
// getBoundingClientRect, width/height = its full content box). Both directions use
// the SAME metrics, so they are exact inverses — and because left/top already move
// with the page scroll, no separate scroll term appears (using one would double-
// count window scroll; see the build-5 coordinate ruling).

const EPS = 1e-9;
const near = (a, b) => Math.abs(a - b) < EPS;

const METRIC_SETS = [
  { left: 0, top: 0, width: 1000, height: 800 },
  { left: 120, top: 64, width: 900, height: 2400 }, // wide/tall board, offset rail
  { left: -300, top: -1500, width: 900, height: 2400 }, // viewer scrolled down/right: rect goes negative
  { left: 40.5, top: 12.25, width: 733.3, height: 1280.75 }, // fractional
];

test("toBoardFraction/fromBoardFraction: from(to(p)) ~= p for many points and metric sets", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 500, y: 400 },
    { x: 123.4, y: 987.6 },
    { x: -50, y: -50 },
  ];
  for (const m of METRIC_SETS) {
    for (const p of points) {
      const back = fromBoardFraction(toBoardFraction(p, m), m);
      assert.ok(near(back.x, p.x) && near(back.y, p.y), `round-trip ${JSON.stringify(p)} @ ${JSON.stringify(m)} -> ${JSON.stringify(back)}`);
    }
  }
});

test("toBoardFraction: the content origin maps to ~{0,0}", () => {
  const m = { left: 120, top: 64, width: 900, height: 2400 };
  const f = toBoardFraction({ x: m.left, y: m.top }, m);
  assert.ok(near(f.x, 0) && near(f.y, 0));
});

test("toBoardFraction: the content bottom-right maps to ~{1,1}", () => {
  const m = { left: 120, top: 64, width: 900, height: 2400 };
  const f = toBoardFraction({ x: m.left + m.width, y: m.top + m.height }, m);
  assert.ok(near(f.x, 1) && near(f.y, 1));
});

test("a fraction round-trips identically under a different (scrolled) rect", () => {
  // The SAME board cell (frac) sent by a scrolled viewer and placed by an
  // un-scrolled viewer: each uses its OWN rect; the fraction is the shared truth.
  const sender = { left: -300, top: -1500, width: 900, height: 2400 }; // scrolled
  const receiver = { left: 120, top: 64, width: 900, height: 2400 }; // not scrolled
  const senderPoint = { x: 150, y: 300 }; // somewhere on the sender's screen
  const frac = toBoardFraction(senderPoint, sender);
  const placed = fromBoardFraction(frac, receiver);
  // Same board-local offset in both: (point - left) is scroll-invariant.
  assert.ok(near(placed.x - receiver.left, senderPoint.x - sender.left));
  assert.ok(near(placed.y - receiver.top, senderPoint.y - sender.top));
});

// --- reconcileCursors -------------------------------------------------------
// Given the cursor ids currently drawn and the ids present in the latest presence
// snapshot, return the drawn ids that should be DROPPED (no longer present). This
// is how a disconnect (which only fires a presence frame, never a `gone`) removes
// a stale cursor.

test("reconcileCursors: drawn {a,b,c} vs present {a,c} => drop [b]", () => {
  assert.deepEqual(reconcileCursors(["a", "b", "c"], ["a", "c"]), ["b"]);
});

test("reconcileCursors: nothing drawn => drop nothing", () => {
  assert.deepEqual(reconcileCursors([], ["a", "c"]), []);
});

test("reconcileCursors: presence is a superset => drop nothing", () => {
  assert.deepEqual(reconcileCursors(["a", "c"], ["a", "b", "c"]), []);
});
