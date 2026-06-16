// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../public/js/store.js";
import { ActionTypes, moveStory } from "../public/js/actions.js";
import { validatePlan, migratePlan, exportPlan, extractPlan } from "../public/js/plan-io.js";
import { readFileSync } from "node:fs";

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

/** A pre-Brief-7 v1 plan: no deps field, schemaVersion 1 (what an old save looks like). */
function v1Plan() {
  const p = placedPlan();
  delete p.deps;
  p.meta = { ...p.meta, schemaVersion: 1 };
  return p;
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

// Case 4: the newer-version guard still holds after the v2 bump.
test("migratePlan: a schemaVersion newer than this build (v3) fails clearly", () => {
  const plan = placedPlan();
  plan.meta.schemaVersion = 3;
  const result = migratePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /newer/);
});

// Cases 1 + 2: the v1->v2 migrator adds the empty deps field, bumps the version,
// and touches nothing else (the seam's first real use).
test("migratePlan: a v1 plan gains deps [] and schemaVersion 2, other keys untouched", () => {
  const plan = v1Plan();
  const result = migratePlan(plan);
  assert.equal(result.ok, true);
  assert.deepEqual(result.plan.deps, []);
  assert.equal(result.plan.meta.schemaVersion, 2);
  assert.deepEqual(result.plan.stories, plan.stories); // representative key untouched
  assert.deepEqual(result.plan.backlog, plan.backlog);
});

// Case 3: a v2 plan migrates as a no-op.
test("migratePlan: a v2 plan passes through unchanged", () => {
  const plan = placedPlan(); // already v2 (createInitialState seeds it)
  const result = migratePlan(plan);
  assert.equal(result.ok, true);
  assert.equal(result.plan, plan);
});

// --- Case 5: a fresh plan is v2 with an empty deps array -------------------

test("createInitialState: a fresh plan is schemaVersion 2 with deps []", () => {
  const s = createInitialState("2026-07-06");
  assert.equal(s.meta.schemaVersion, 2);
  assert.deepEqual(s.deps, []);
});

// --- Cases 6-10: validatePlan learns the deps field ------------------------

test("validatePlan: a plan with one valid pair (two distinct existing ids) passes", () => {
  const plan = placedPlan();
  plan.deps = [{ id: "dep_1", blockerId: "a", blockedId: "b" }];
  assert.equal(validatePlan(plan).ok, true);
});

test("validatePlan: a pair referencing an unknown story fails, naming that id", () => {
  const plan = placedPlan();
  plan.deps = [{ id: "dep_1", blockerId: "a", blockedId: "ghost" }];
  const result = validatePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /ghost/);
});

test("validatePlan: a self-dependency (blocker === blocked) fails clearly", () => {
  const plan = placedPlan();
  plan.deps = [{ id: "dep_1", blockerId: "a", blockedId: "a" }];
  const result = validatePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /itself/);
});

test("validatePlan: a duplicate pair (same blocker and blocked) fails clearly", () => {
  const plan = placedPlan();
  plan.deps = [
    { id: "dep_1", blockerId: "a", blockedId: "b" },
    { id: "dep_2", blockerId: "a", blockedId: "b" },
  ];
  const result = validatePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /duplicate/);
});

test("validatePlan: a non-array deps fails with a missing-or-invalid-key reason", () => {
  const plan = placedPlan();
  plan.deps = "nope";
  const result = validatePlan(plan);
  assert.equal(result.ok, false);
  assert.match(result.reason, /deps/);
});

// --- R8 (Brief 9): a malformed deps ELEMENT fails cleanly, never throws ------

test("validatePlan: a deps element that is not an object fails cleanly (does not throw)", () => {
  const plan = placedPlan();
  plan.deps = [null];
  let result;
  assert.doesNotThrow(() => {
    result = validatePlan(plan);
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /dependency/i);
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

// --- phase2-build3 #7: the demo file passes the import load boundary ---------
// The one-click "Load demo" button reuses the file-import pipeline verbatim
// (extractPlan("file") -> migratePlan -> validatePlan) on the bundled sample.
// A cheap regression tripwire: if the schema bumps and the sample is not
// rebuilt, this goes red before the demo button ships a broken load.

test("public/samples/sample-plan.json passes the file-import load boundary", () => {
  const parsed = JSON.parse(readFileSync(new URL("../public/samples/sample-plan.json", import.meta.url), "utf8"));
  const ext = extractPlan(parsed, "file");
  assert.equal(ext.ok, true, ext.ok ? "" : ext.reason);
  const mig = migratePlan(ext.plan);
  assert.equal(mig.ok, true, mig.ok ? "" : mig.reason);
  const val = validatePlan(mig.plan);
  assert.equal(val.ok, true, val.ok ? "" : val.reason);
});
