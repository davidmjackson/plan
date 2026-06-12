// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../public/js/store.js";
import { ActionTypes, moveStory } from "../public/js/actions.js";
import { sprintPlacedPoints } from "../public/js/board-selectors.js";
import { backlogGroups, epicSummary } from "../public/js/backlog-selectors.js";
import { pillState } from "../public/js/plan-maths.js";

const A = ActionTypes;
const epic = (id, title) => ({ type: A.ADD_EPIC, payload: { id, title } });
const story = (id, epicId, points) => ({
  type: A.ADD_STORY,
  payload: { id, title: id.toUpperCase(), summary: "", points, epicId },
});
const place = (storyId, index) =>
  moveStory({ storyId, target: { kind: "sprint", index }, beforeId: null });

// --- Case 1: PLACED IS POINTS, NOT COUNT (the keystone) --------------------

test("sprintPlacedPoints sums points (not count); the pill colours track points", () => {
  let s = createInitialState("2026-07-06"); // capacity 18 (velocity 20, buffer 10)
  s = reduce(s, story("a", null, 8));
  s = reduce(s, story("b", null, 8));
  s = reduce(s, place("a", 0));
  s = reduce(s, place("b", 0));
  assert.equal(sprintPlacedPoints(s, 0), 16); // count would be 2
  assert.equal(pillState(sprintPlacedPoints(s, 0), 18), "neutral");

  s = reduce(s, story("c", null, 3));
  s = reduce(s, place("c", 0));
  assert.equal(sprintPlacedPoints(s, 0), 19); // count would be 3
  assert.equal(pillState(sprintPlacedPoints(s, 0), 18), "amber"); // 5.6% over

  s = reduce(s, story("d", null, 5));
  s = reduce(s, place("d", 0));
  assert.equal(sprintPlacedPoints(s, 0), 24); // count would be 4
  assert.equal(pillState(sprintPlacedPoints(s, 0), 18), "red"); // 33% over
});

test("sprintPlacedPoints is 0 for an empty sprint and ignores out-of-range indices safely", () => {
  const s = createInitialState("2026-07-06");
  assert.equal(sprintPlacedPoints(s, 0), 0);
  assert.equal(sprintPlacedPoints(s, 999), 0);
});

// --- Case 9: backlog shows UNPLACED only -----------------------------------

test("epicSummary.unplacedCount and unplacedPoints both drop when a story is placed", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E2", "Two"));
  s = reduce(s, story("x", "E2", 3));
  s = reduce(s, story("y", "E2", 5));
  s = reduce(s, story("z", "E2", 2));
  assert.deepEqual(epicSummary(s, "E2"), { unplacedCount: 3, unplacedPoints: 10 });

  s = reduce(s, place("x", 0));
  assert.deepEqual(epicSummary(s, "E2"), { unplacedCount: 2, unplacedPoints: 7 });

  // placed story leaves the panel
  const e2 = backlogGroups(s).find((g) => g.epic?.id === "E2");
  assert.deepEqual(e2.stories.map((st) => st.id), ["y", "z"]);
  assert.equal(Object.keys(s.stories).length, 3); // total unchanged
});

// --- Edge: the No-epic group persists while a null-epic story is placed -----

test("backlogGroups keeps the No-epic group as a drop target when its only story is placed", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, story("loose", null, 3));
  assert.equal(backlogGroups(s).at(-1).epic, null); // present in the backlog

  s = reduce(s, place("loose", 0));
  const last = backlogGroups(s).at(-1);
  assert.equal(last.epic, null); // group still rendered so the card can come home
  assert.deepEqual(last.stories, []); // but it holds no backlog cards now
});

test("backlogGroups has no No-epic group when no null-epic story exists at all", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("a", "E1", 3));
  assert.equal(backlogGroups(s).some((g) => g.epic === null), false);
});
