// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { regenerate } from "../public/js/regenerate.js";
import { generateSprints } from "../public/js/plan-maths.js";

const DEFAULTS = {
  startDate: "2026-07-06",
  durationMonths: 3,
  sprintWeeks: 2,
  velocity: 20,
  bufferPct: 10,
};

// A seeded 7-sprint plan with stories placed across several sprints + backlog.
function seededState(settings = DEFAULTS) {
  const placements = [
    ["s0a", "s0b"], ["s1a"], [], ["s3a"], [], ["s5a", "s5b"], ["s6a"],
  ];
  const sprints = generateSprints(settings).map((s) => ({
    ...s,
    placedStoryIds: placements[s.index] ?? [],
  }));
  return { settings, sprints, backlog: ["bk1"] };
}

// Invariant helper: the full set of story ids must be conserved by any regen.
function allStoryIds(state) {
  return [...state.sprints.flatMap((s) => s.placedStoryIds), ...state.backlog].sort();
}

test("start-date change re-dates only; placements and backlog untouched", () => {
  const prev = seededState();
  const next = { ...DEFAULTS, startDate: "2026-07-13" };
  const result = regenerate(prev, next);

  assert.equal(result.sprints.length, 7);
  assert.equal(result.sprints[0].startDate, "2026-07-13"); // re-dated
  assert.deepEqual(result.returnedStoryIds, []);
  assert.deepEqual(result.backlog, ["bk1"]);
  result.sprints.forEach((s, i) => {
    assert.deepEqual(s.placedStoryIds, prev.sprints[i].placedStoryIds);
  });
});

test("velocity/buffer change leaves structure, dates and placements untouched", () => {
  const prev = seededState();
  const next = { ...DEFAULTS, velocity: 30, bufferPct: 25 };
  const result = regenerate(prev, next);

  assert.equal(result.sprints.length, 7);
  assert.deepEqual(result.returnedStoryIds, []);
  result.sprints.forEach((s, i) => {
    assert.equal(s.startDate, prev.sprints[i].startDate);
    assert.deepEqual(s.placedStoryIds, prev.sprints[i].placedStoryIds);
  });
});

test("duration shrink returns removed-sprint stories to the TOP of the backlog, deletes nothing", () => {
  const prev = seededState();
  const next = { ...DEFAULTS, durationMonths: 1 }; // 7 -> 3 sprints
  const result = regenerate(prev, next);

  assert.equal(result.sprints.length, 3);
  // removed sprints 3,4,5,6 in order: s3a, (none), s5a s5b, s6a
  assert.deepEqual(result.returnedStoryIds, ["s3a", "s5a", "s5b", "s6a"]);
  // returned stories sit at the TOP, original backlog beneath
  assert.deepEqual(result.backlog, ["s3a", "s5a", "s5b", "s6a", "bk1"]);
  // surviving sprints keep their placements by index
  assert.deepEqual(result.sprints[0].placedStoryIds, ["s0a", "s0b"]);
  assert.deepEqual(result.sprints[1].placedStoryIds, ["s1a"]);
  assert.deepEqual(result.sprints[2].placedStoryIds, []);
  // nothing deleted
  assert.deepEqual(allStoryIds(result), allStoryIds(prev));
});

test("sprint-length increase reduces count, re-dates, returns overflow by index", () => {
  const prev = seededState();
  const next = { ...DEFAULTS, sprintWeeks: 4 }; // 3 months / 28d -> 4 sprints
  const result = regenerate(prev, next);

  assert.equal(result.sprints.length, 4);
  assert.equal(result.sprints[0].startDate, "2026-07-06");
  assert.equal(result.sprints[0].days, 28); // re-dated to 4-week span
  // sprints 4,5,6 removed -> s5a s5b s6a returned (sprint 4 was empty)
  assert.deepEqual(result.returnedStoryIds, ["s5a", "s5b", "s6a"]);
  assert.deepEqual(result.sprints[3].placedStoryIds, ["s3a"]); // index 3 survives
  assert.deepEqual(allStoryIds(result), allStoryIds(prev));
});

test("plan growth adds empty sprints, preserves existing placements, returns nothing", () => {
  const prev = seededState({ ...DEFAULTS, durationMonths: 1 }); // 3 sprints seeded
  const next = { ...DEFAULTS, durationMonths: 3 }; // -> 7 sprints
  const result = regenerate(prev, next);

  assert.equal(result.sprints.length, 7);
  assert.deepEqual(result.returnedStoryIds, []);
  assert.deepEqual(result.sprints[0].placedStoryIds, ["s0a", "s0b"]);
  assert.deepEqual(result.sprints[3].placedStoryIds, []); // newly created
  assert.deepEqual(result.sprints[6].placedStoryIds, []);
  assert.deepEqual(allStoryIds(result), allStoryIds(prev));
});
