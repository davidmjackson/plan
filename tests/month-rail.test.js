// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { dominantMonth, assignSprintsToMonths } from "../public/js/month-rail.js";
import { generateSprints } from "../public/js/plan-maths.js";

test("dominantMonth picks the month holding the majority of a sprint's days", () => {
  assert.equal(dominantMonth("2026-07-06", "2026-07-19"), "2026-07"); // wholly July
  assert.equal(dominantMonth("2026-07-20", "2026-08-02"), "2026-07"); // 12 Jul vs 2 Aug
  assert.equal(dominantMonth("2026-08-31", "2026-09-13"), "2026-09"); // 1 Aug vs 13 Sep
});

test("dominantMonth breaks a 7/7 tie in favour of the earlier month", () => {
  // 25-31 Jul = 7 days, 1-7 Aug = 7 days
  assert.equal(dominantMonth("2026-07-25", "2026-08-07"), "2026-07");
});

test("assignSprintsToMonths returns one ordered segment per dominant month", () => {
  const sprints = generateSprints({
    startDate: "2026-07-06",
    durationMonths: 3,
    sprintWeeks: 2,
    velocity: 20,
    bufferPct: 10,
  });
  const rail = assignSprintsToMonths(sprints);
  assert.deepEqual(rail, [
    { monthKey: "2026-07", label: "JUL", sprintIndexes: [0, 1] },
    { monthKey: "2026-08", label: "AUG", sprintIndexes: [2, 3] },
    { monthKey: "2026-09", label: "SEP", sprintIndexes: [4, 5] },
    { monthKey: "2026-10", label: "OCT", sprintIndexes: [6] },
  ]);
});

test("assignSprintsToMonths covers every sprint exactly once", () => {
  const sprints = generateSprints({
    startDate: "2026-07-06",
    durationMonths: 1,
    sprintWeeks: 1,
    velocity: 20,
    bufferPct: 10,
  });
  const rail = assignSprintsToMonths(sprints);
  const covered = rail.flatMap((seg) => seg.sprintIndexes);
  assert.deepEqual(
    covered,
    sprints.map((s) => s.index),
  );
});
