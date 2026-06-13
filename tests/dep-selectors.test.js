// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../public/js/store.js";
import { ActionTypes, moveStory } from "../public/js/actions.js";
import {
  storyLocation,
  locationLabel,
  depRole,
  depLabel,
  isViolation,
  depsForStory,
  depBadges,
  pickableDepTargets,
  connectorsToDraw,
} from "../public/js/dep-selectors.js";

const A = ActionTypes;
const story = (id, points = 3) => ({
  type: A.ADD_STORY,
  payload: { id, title: id.toUpperCase(), summary: "", points, epicId: null },
});
const place = (storyId, index) =>
  moveStory({ storyId, target: { kind: "sprint", index }, beforeId: null });
/** attach a deps array the way the reducer will once LINK_DEP exists */
const withDeps = (s, deps) => ({ ...s, deps });
const pair = (id, blockerId, blockedId) => ({ id, blockerId, blockedId });

// Fixture: a, b placed in sprints; c left in the backlog.
function fixture() {
  let s = createInitialState("2026-07-06"); // 7 sprints
  s = reduce(s, story("a"));
  s = reduce(s, story("b"));
  s = reduce(s, story("c"));
  s = reduce(s, place("a", 0));
  s = reduce(s, place("b", 1));
  // c stays in the backlog
  return s;
}

// --- Case 11: LOCATION -----------------------------------------------------

test("storyLocation: sprint index, backlog, and null for unknown", () => {
  const s = fixture();
  assert.deepEqual(storyLocation(s, "b"), { kind: "sprint", index: 1 });
  assert.deepEqual(storyLocation(s, "c"), { kind: "backlog" });
  assert.equal(storyLocation(s, "nope"), null);
});

test("locationLabel: the sprint's own name, or 'Backlog'", () => {
  const s = fixture();
  assert.equal(locationLabel(s, { kind: "sprint", index: 1 }), s.sprints[1].name);
  assert.equal(locationLabel(s, { kind: "backlog" }), "Backlog");
});

// --- Case 12: ROLE AND LABEL (shared identity) -----------------------------

test("depRole: blocks for the blocker, needs for the blocked, null for a stranger", () => {
  const d = pair("dep_1", "b", "a"); // b blocks a; a needs b
  assert.equal(depRole(d, "b"), "blocks");
  assert.equal(depRole(d, "a"), "needs");
  assert.equal(depRole(d, "c"), null);
});

test("depLabel: D + (deps index + 1); both endpoints of a pair share one label", () => {
  const d1 = pair("dep_1", "b", "a");
  const d2 = pair("dep_2", "a", "c");
  const s = withDeps(fixture(), [d1, d2]);
  assert.equal(depLabel(s, d1), "D1");
  assert.equal(depLabel(s, d2), "D2");
  // shared: the same pair reads D1 from either story's row
  assert.equal(depLabel(s, d1), depLabel(s, d1));
});

// --- Case 14/15: VIOLATION RULE --------------------------------------------

test("isViolation: true only when both scheduled AND blocked sits earlier than blocker", () => {
  // blocker b in sprint 1, blocked a in sprint 0 -> a is planned before what it needs
  const s = withDeps(fixture(), [pair("dep_1", "b", "a")]);
  assert.equal(isViolation(s, s.deps[0]), true);
});

test("isViolation: false by correct order, same sprint, and backlog (G7 not evaluated)", () => {
  let s = fixture();
  // correct order: blocker a (sprint 0) before blocked b (sprint 1)
  assert.equal(isViolation(withDeps(s, [pair("d", "a", "b")]), pair("d", "a", "b")), false);
  // same sprint: place a and b both in sprint 0
  let same = reduce(s, place("b", 0));
  assert.equal(isViolation(withDeps(same, [pair("d", "b", "a")]), pair("d", "b", "a")), false);
  // backlog side (c): neutral regardless of the other side's sprint
  assert.equal(isViolation(withDeps(s, [pair("d", "c", "a")]), pair("d", "c", "a")), false);
  assert.equal(isViolation(withDeps(s, [pair("d", "a", "c")]), pair("d", "a", "c")), false);
});

// --- depsForStory and depBadges (editor rows / card badges) -----------------

test("depsForStory: one row per touching pair with role, other endpoint, location, violation", () => {
  const s = withDeps(fixture(), [pair("dep_1", "b", "a")]); // violation (a earlier than b)
  const rows = depsForStory(s, "a");
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.label, "D1");
  assert.equal(r.role, "needs"); // a needs b
  assert.equal(r.otherId, "b");
  assert.equal(r.otherTitle, "B");
  assert.deepEqual(r.otherLocation, { kind: "sprint", index: 1 });
  assert.equal(r.violation, true);
  // b's row sees the same pair from the other side
  assert.equal(depsForStory(s, "b")[0].role, "blocks");
});

test("depBadges: a label+violation per touching pair; a story with no pair has none", () => {
  const s = withDeps(fixture(), [pair("dep_1", "b", "a")]);
  assert.deepEqual(depBadges(s, "a"), [{ label: "D1", violation: true }]);
  assert.deepEqual(depBadges(s, "b"), [{ label: "D1", violation: true }]);
  assert.deepEqual(depBadges(s, "c"), []);
});

// --- Case 16: PICKER EXCLUSION ---------------------------------------------

test("pickableDepTargets: excludes self and already-paired, includes a backlog story", () => {
  const s = withDeps(fixture(), [pair("dep_1", "b", "a")]); // a already paired with b
  const ids = pickableDepTargets(s, "a").map((t) => t.id);
  assert.ok(!ids.includes("a"), "excludes self");
  assert.ok(!ids.includes("b"), "excludes already-paired");
  assert.ok(ids.includes("c"), "includes the backlog story");
  // each target carries id, title, location for grouping
  const cTarget = pickableDepTargets(s, "a").find((t) => t.id === "c");
  assert.deepEqual(cTarget, { id: "c", title: "C", location: { kind: "backlog" } });
});

// --- Brief 8 (slice 2): connectorsToDraw, the board drawing set ------------
// Pure "which lines exist" core, unit-tested before any SVG. fromIndex is the
// blocker's (do-first) sprint index, toIndex the blocked's (dependent) index;
// the entry names blockerId/blockedId so the view can place the arrowhead.

test("connectorsToDraw: both endpoints in different sprints draws one connector", () => {
  // a in sprint 0, b in sprint 1; blocker a (do first) -> blocked b
  const s = withDeps(fixture(), [pair("dep_1", "a", "b")]);
  const drawn = connectorsToDraw(s);
  assert.equal(drawn.length, 1);
  const c = drawn[0];
  assert.equal(c.kind, "connector");
  assert.equal(c.fromIndex, 0); // blocker a
  assert.equal(c.toIndex, 1); // blocked b
  assert.equal(c.dep, s.deps[0]);
});

test("connectorsToDraw: both endpoints in the SAME sprint is a tether (fromIndex === toIndex)", () => {
  let s = reduce(fixture(), place("b", 0)); // move b alongside a in sprint 0
  s = withDeps(s, [pair("dep_1", "a", "b")]);
  const drawn = connectorsToDraw(s);
  assert.equal(drawn.length, 1);
  assert.equal(drawn[0].kind, "tether");
  assert.equal(drawn[0].fromIndex, 0);
  assert.equal(drawn[0].toIndex, 0);
});

test("connectorsToDraw: a pair with either endpoint in the backlog draws nothing (R3/G7)", () => {
  // c is in the backlog; neither slot order produces an entry
  assert.equal(connectorsToDraw(withDeps(fixture(), [pair("d", "a", "c")])).length, 0);
  assert.equal(connectorsToDraw(withDeps(fixture(), [pair("d", "c", "a")])).length, 0);
});

test("connectorsToDraw: violation flag matches isViolation across order/same-sprint/backlog", () => {
  // out of order: blocker b (sprint 1) but blocked a (sprint 0) -> violation
  const bad = withDeps(fixture(), [pair("d", "b", "a")]);
  assert.equal(connectorsToDraw(bad)[0].violation, true);
  // correct order: blocker a (sprint 0) before blocked b (sprint 1) -> false
  const good = withDeps(fixture(), [pair("d", "a", "b")]);
  assert.equal(connectorsToDraw(good)[0].violation, false);
  // same sprint -> false
  const same = withDeps(reduce(fixture(), place("b", 0)), [pair("d", "b", "a")]);
  assert.equal(connectorsToDraw(same)[0].violation, false);
});

test("connectorsToDraw: records blocker/blocked ids and indices so the view can aim the arrowhead", () => {
  // pair stored as { blockerId: b, blockedId: a } — the dependent (arrowhead) end is a
  const s = withDeps(fixture(), [pair("dep_1", "b", "a")]);
  const c = connectorsToDraw(s)[0];
  assert.equal(c.blockerId, "b");
  assert.equal(c.blockedId, "a");
  assert.equal(c.fromIndex, 1); // blocker b in sprint 1
  assert.equal(c.toIndex, 0); // blocked a in sprint 0 (the arrowhead end)
});
