// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../public/js/store.js";
import { ActionTypes, moveStory } from "../public/js/actions.js";
import { validatePlan, migratePlan, exportPlan, extractPlan } from "../public/js/plan-io.js";

const A = ActionTypes;
const epic = (id, title) => ({ type: A.ADD_EPIC, payload: { id, title } });
const story = (id, epicId, points) => ({
  type: A.ADD_STORY,
  payload: { id, title: id.toUpperCase(), summary: "", points, epicId },
});

/** A real plan with stories placed across sprints and some left in the backlog. */
function placedPlan() {
  let s = createInitialState("2026-07-06"); // 7 sprints
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, epic("E2", "Two"));
  s = reduce(s, story("a", "E1", 5));
  s = reduce(s, story("b", "E1", 3));
  s = reduce(s, story("c", "E2", 8));
  s = reduce(s, story("d", null, 2)); // epic-less story, stays in backlog
  s = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 1 }, beforeId: null }));
  s = reduce(s, moveStory({ storyId: "b", target: { kind: "sprint", index: 3 }, beforeId: null }));
  s = reduce(s, moveStory({ storyId: "c", target: { kind: "sprint", index: 1 }, beforeId: null }));
  return s; // a,b,c placed; d in backlog
}

// --- Case 1: fresh default plan validates ----------------------------------

test("validatePlan: a fresh default plan passes", () => {
  const result = validatePlan(createInitialState("2026-07-06"));
  assert.equal(result.ok, true);
  assert.deepEqual(result.plan, createInitialState("2026-07-06"));
});

// --- Case 2: real placed plan validates ------------------------------------

test("validatePlan: a plan with stories placed across sprints and backlog passes", () => {
  const plan = placedPlan();
  const result = validatePlan(plan);
  assert.equal(result.ok, true);
  assert.equal(result.plan, plan);
});

// --- Case 3: missing top-level key fails, named ----------------------------

test("validatePlan: a plan with stories removed fails and names the missing key", () => {
  const plan = placedPlan();
  delete plan.stories;
  const result = validatePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /stories/);
});

// --- Case 4: dangling backlog id fails -------------------------------------

test("validatePlan: a backlog id with no matching story fails (conservation)", () => {
  const plan = placedPlan();
  plan.backlog.push("ghost");
  const result = validatePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /ghost/);
});

// --- Case 5: dangling placed id fails --------------------------------------

test("validatePlan: a sprint placedStoryIds id with no matching story fails", () => {
  const plan = placedPlan();
  plan.sprints[1].placedStoryIds.push("phantom");
  const result = validatePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /phantom/);
});

// --- Case 6: duplicate id fails (full conservation, with 4 + 5) ------------

test("validatePlan: the same story id in two arrays fails", () => {
  const plan = placedPlan();
  plan.backlog.push("a"); // "a" is already placed in sprint 1
  const result = validatePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /\ba\b/);
});

// --- Case 7: orphan epicId fails -------------------------------------------

test("validatePlan: a story whose epicId names a non-existent epic fails", () => {
  const plan = placedPlan();
  plan.stories.a.epicId = "E-NOPE";
  const result = validatePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /E-NOPE/);
});

// --- Case 8: bad points fail (reuses validate.js) --------------------------

test("validatePlan: a story with 0, negative, or non-integer points fails", () => {
  for (const bad of [0, -3, 2.5]) {
    const plan = placedPlan();
    plan.stories.a.points = bad;
    const result = validatePlan(plan);
    assert.equal(result.ok, false, `points ${bad} should fail`);
    assert.match(result.reason, /points/);
  }
});

// --- Case 9: schema version guard (the migrate seam) -----------------------

test("migratePlan: a missing schemaVersion fails", () => {
  const plan = placedPlan();
  delete plan.meta.schemaVersion;
  const result = migratePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /version/);
});

test("migratePlan: a schemaVersion newer than this build fails clearly", () => {
  const plan = placedPlan();
  plan.meta.schemaVersion = 2;
  const result = migratePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /newer/);
});

test("migratePlan: schemaVersion 1 passes through", () => {
  const plan = placedPlan();
  const result = migratePlan(plan);
  assert.equal(result.ok, true);
  assert.equal(result.plan, plan);
});

// --- Case 10: foreign file fails on import ---------------------------------

test("extractPlan(file): an object with no app header is refused as foreign", () => {
  const result = extractPlan({ meta: {}, stories: {} }, "file");
  assert.equal(result.ok, false);
  assert.match(result.reason, /sprintplan/);
});

test("extractPlan(file): a sprintplan file yields the inner plan", () => {
  const state = placedPlan();
  const file = exportPlan(state, "2026-06-12T10:00:00.000Z");
  const result = extractPlan(file, "file");
  assert.equal(result.ok, true);
  assert.deepEqual(result.plan, { ...state, lastReturnedStoryIds: [] });
});

// --- Case 11: round-trip conservation --------------------------------------

test("round-trip: export -> extract -> validate deep-equals the source (lastReturned reset)", () => {
  const state = placedPlan();
  state.lastReturnedStoryIds = ["a"]; // transient; must come back as []
  const file = exportPlan(state, "2026-06-12T10:00:00.000Z");
  const ext = extractPlan(file, "file");
  assert.equal(ext.ok, true);
  const val = validatePlan(ext.plan);
  assert.equal(val.ok, true);
  assert.deepEqual(val.plan, { ...state, lastReturnedStoryIds: [] });
});

// --- Case 12: legacy bare-state restore tolerated --------------------------

test("extractPlan(restore): a legacy bare state (no envelope) is returned and validates", () => {
  const bare = placedPlan();
  const result = extractPlan(bare, "restore");
  assert.equal(result.ok, true);
  assert.equal(result.plan, bare);
  assert.equal(validatePlan(result.plan).ok, true);
});

test("extractPlan(restore): the { savedAt, plan } envelope yields the inner plan", () => {
  const bare = placedPlan();
  const result = extractPlan({ savedAt: "2026-06-12T10:00:00.000Z", plan: bare }, "restore");
  assert.equal(result.ok, true);
  assert.equal(result.plan, bare);
});
