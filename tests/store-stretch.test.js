// @ts-check
/**
 * phase2-build6: the SET_STORY_STRETCH reducer case and THE HONESTY INVARIANT —
 * marking a story stretch records intent but NEVER discounts capacity. The
 * reducer writes the flag and preserves every other field; the capacity
 * authorities (sprintPlacedPoints, pillState, planBarData) are byte-identical
 * before and after the mark.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../public/js/store.js";
import { ActionTypes, setStoryStretch, moveStory } from "../public/js/actions.js";
import { sprintPlacedPoints, planBarData } from "../public/js/board-selectors.js";
import { sprintCapacity, pillState } from "../public/js/plan-maths.js";

const A = ActionTypes;
const epic = (id, title) => ({ type: A.ADD_EPIC, payload: { id, title } });
const story = (id, epicId, points) => ({
  type: A.ADD_STORY,
  payload: { id, title: id.toUpperCase(), summary: `sum ${id}`, points, epicId },
});

/** A plan with a heavily-loaded sprint so it is comfortably over capacity. */
function loadedPlan() {
  let s = createInitialState("2026-07-06"); // velocity 20, buffer 10 => cap 18/sprint
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("a", "E1", 13));
  s = reduce(s, story("b", "E1", 8));
  s = reduce(s, story("c", "E1", 5)); // stays in backlog
  s = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 0 }, beforeId: null }));
  s = reduce(s, moveStory({ storyId: "b", target: { kind: "sprint", index: 0 }, beforeId: null }));
  return s; // sprint 0 holds a+b = 21 pts (over the 18 cap); c in backlog
}

// --- the action + reducer ---------------------------------------------------

test("setStoryStretch: the creator returns a whole-payload { id, stretch } action", () => {
  assert.deepEqual(setStoryStretch({ id: "a", stretch: true }), {
    type: "SET_STORY_STRETCH",
    payload: { id: "a", stretch: true },
  });
});

test("SET_STORY_STRETCH true sets the flag and leaves every other field untouched", () => {
  const s0 = loadedPlan();
  const s1 = reduce(s0, setStoryStretch({ id: "a", stretch: true }));
  assert.equal(s1.stories.a.stretch, true);
  // other fields of a preserved
  assert.equal(s1.stories.a.title, "A");
  assert.equal(s1.stories.a.summary, "sum a");
  assert.equal(s1.stories.a.points, 13);
  assert.equal(s1.stories.a.epicId, "E1");
  // other stories untouched
  assert.deepEqual(s1.stories.b, s0.stories.b);
  assert.deepEqual(s1.stories.c, s0.stories.c);
  // placement arrays untouched
  assert.deepEqual(s1.sprints, s0.sprints);
  assert.deepEqual(s1.backlog, s0.backlog);
});

test("SET_STORY_STRETCH false clears the flag", () => {
  let s = loadedPlan();
  s = reduce(s, setStoryStretch({ id: "a", stretch: true }));
  s = reduce(s, setStoryStretch({ id: "a", stretch: false }));
  assert.equal(s.stories.a.stretch, false);
});

test("an EDIT_STORY after a stretch mark preserves stretch (reducer spreads the existing story)", () => {
  let s = loadedPlan();
  s = reduce(s, setStoryStretch({ id: "a", stretch: true }));
  s = reduce(s, {
    type: A.EDIT_STORY,
    payload: { id: "a", title: "A2", summary: "edited", points: 13, epicId: "E1" },
  });
  assert.equal(s.stories.a.stretch, true); // survived the field edit
  assert.equal(s.stories.a.title, "A2");
});

test("SET_STORY_STRETCH on an unknown id is a safe no-op for known stories", () => {
  const s0 = loadedPlan();
  const s1 = reduce(s0, setStoryStretch({ id: "ghost", stretch: true }));
  assert.deepEqual(s1.stories.a, s0.stories.a);
  assert.deepEqual(s1.stories.b, s0.stories.b);
  assert.ok(!("ghost" in s1.stories), "no phantom story is created for an unknown id");
});

// --- THE HONESTY INVARIANT (R1, the hard one) -------------------------------

test("marking a placed story stretch never moves the sprint total, the pill, or the plan bar", () => {
  const s0 = loadedPlan();
  const cap = sprintCapacity(s0.sprints[0], s0.settings);
  const placedBefore = sprintPlacedPoints(s0, 0);
  const pillBefore = pillState(placedBefore, cap);
  const barBefore = planBarData(s0);

  const s1 = reduce(s0, setStoryStretch({ id: "a", stretch: true }));

  assert.equal(sprintPlacedPoints(s1, 0), placedBefore, "sprint placed total unmoved");
  assert.equal(pillState(sprintPlacedPoints(s1, 0), cap), pillBefore, "pill state unmoved");
  const barAfter = planBarData(s1);
  assert.equal(barAfter.tone, barBefore.tone, "plan-bar tone unmoved");
  assert.equal(barAfter.planned, barBefore.planned, "plan-bar planned points unmoved");
  // the stretch story is still counted in full
  assert.equal(placedBefore, 21);
  assert.equal(pillBefore, "red");
});
