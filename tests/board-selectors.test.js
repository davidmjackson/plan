// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../public/js/store.js";
import { ActionTypes, moveStory } from "../public/js/actions.js";
import { sprintPlacedPoints, planSummary } from "../public/js/board-selectors.js";
import { backlogGroups, epicSummary } from "../public/js/backlog-selectors.js";
import { pillState } from "../public/js/plan-maths.js";
import { setDurationMonths } from "../public/js/actions.js";

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

// --- planSummary: the resume-card derived numbers (Brief 6) ------------------
// months is settings.durationMonths (NOT sprints); sprints is sprints.length;
// stories is ALL stories; placedPoints is PLACED only (backlog excluded),
// summed via sprintPlacedPoints. Cases pin every distinction the brief names.

test("planSummary on a fresh default plan: 3 months, 7 sprints, no stories, no placed points", () => {
  const s = createInitialState("2026-07-06"); // 3-month, 2-week default
  assert.equal(s.sprints.length, 7); // confirm the generated count, don't blind-trust
  assert.deepEqual(planSummary(s), { months: 3, sprints: 7, stories: 0, placedPoints: 0 });
});

test("planSummary counts ALL stories but only PLACED points (backlog excluded)", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, story("a", null, 8));
  s = reduce(s, story("b", null, 5));
  s = reduce(s, story("c", null, 3)); // left in the backlog
  s = reduce(s, place("a", 0));
  s = reduce(s, place("b", 1));
  const sum = planSummary(s);
  assert.equal(sum.stories, 3); // all three, even the backlog one
  assert.equal(sum.placedPoints, 13); // 8 + 5 placed; the 3-pt backlog story excluded
  assert.deepEqual(sum, { months: 3, sprints: 7, stories: 3, placedPoints: 13 });
});

test("planSummary keeps months (settings) distinct from sprints (generated) on a 1-month plan", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, setDurationMonths(1));
  const sum = planSummary(s);
  assert.equal(sum.months, 1);
  assert.equal(sum.sprints, 3); // a 1-month/2-week plan generates 3 sprints
});
