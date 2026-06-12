// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adjustedCapacity,
  proratedCapacity,
  sprintCapacity,
  pillState,
  generateSprints,
} from "../public/js/plan-maths.js";

// Brief worked case 1
test("adjustedCapacity = round(velocity * (1 - buffer/100)), minimum 1", () => {
  assert.equal(adjustedCapacity(20, 10), 18);
  assert.equal(adjustedCapacity(15, 20), 12);
  assert.equal(adjustedCapacity(21, 15), 18); // round(17.85) = 18
  assert.equal(adjustedCapacity(5, 0), 5);
});

test("adjustedCapacity floors to 1, never 0", () => {
  assert.equal(adjustedCapacity(1, 100), 1); // round(0) -> clamp 1
});

// Brief worked cases 2 & 3 (the proration numbers) and case 4 (the floor)
test("proratedCapacity = round(adjusted * partialDays / fullDays), minimum 1", () => {
  assert.equal(proratedCapacity(18, 9, 14), 12); // round(11.57)
  assert.equal(proratedCapacity(18, 4, 14), 5); // round(5.14)
});

test("proratedCapacity floors a 1-day partial at low capacity to 1, never 0", () => {
  assert.equal(proratedCapacity(5, 1, 14), 1); // round(0.357) = 0 -> clamp 1
});

// Brief worked case 5
test("pillState: neutral at/under capacity, amber within 10% over, red beyond", () => {
  assert.equal(pillState(18, 18), "neutral"); // exactly at capacity
  assert.equal(pillState(10, 18), "neutral"); // under
  assert.equal(pillState(19, 18), "amber"); // 5.6% over
  assert.equal(pillState(20, 18), "red"); // 11.1% over
});

test("pillState: a 10%-over total is amber (boundary is inclusive)", () => {
  assert.equal(pillState(11, 10), "amber"); // exactly 10% over
  assert.equal(pillState(12, 10), "red"); // 20% over
});

// Brief worked case 2: defaults
test("generateSprints (3 months, 2-week sprints) yields 7 sprints, last partial 9 days", () => {
  const sprints = generateSprints({
    startDate: "2026-07-06",
    durationMonths: 3,
    sprintWeeks: 2,
    velocity: 20,
    bufferPct: 10,
  });
  assert.equal(sprints.length, 7);

  // Sprints 1-6 full, 14 days each
  for (let i = 0; i < 6; i++) {
    assert.equal(sprints[i].index, i);
    assert.equal(sprints[i].name, `Sprint ${i + 1}`);
    assert.equal(sprints[i].days, 14);
    assert.equal(sprints[i].isPartial, false);
  }
  assert.equal(sprints[0].startDate, "2026-07-06");
  assert.equal(sprints[0].endDate, "2026-07-19");

  // Sprint 7: 28 Sep -> 6 Oct, 9 days, partial
  assert.deepEqual(sprints[6], {
    index: 6,
    name: "Sprint 7",
    startDate: "2026-09-28",
    endDate: "2026-10-06",
    days: 9,
    isPartial: true,
  });
});

// Brief worked case 3
test("generateSprints (1 month, 2-week sprints) yields 3 sprints, last partial 4 days", () => {
  const sprints = generateSprints({
    startDate: "2026-07-06",
    durationMonths: 1,
    sprintWeeks: 2,
    velocity: 20,
    bufferPct: 10,
  });
  assert.equal(sprints.length, 3);
  assert.deepEqual(sprints[2], {
    index: 2,
    name: "Sprint 3",
    startDate: "2026-08-03",
    endDate: "2026-08-06",
    days: 4,
    isPartial: true,
  });
});

// Brief: "If plan days divides evenly by sprint days, there is no partial."
test("generateSprints with an even division has no partial final sprint", () => {
  // 2026-07-06 .. 2026-09-06 inclusive = 63 days = 9 x 7-day sprints exactly
  const sprints = generateSprints({
    startDate: "2026-07-06",
    durationMonths: 2,
    sprintWeeks: 1,
    velocity: 20,
    bufferPct: 10,
  });
  assert.equal(sprints.length, 9);
  assert.equal(sprints.every((s) => !s.isPartial), true);
  assert.equal(sprints.every((s) => s.days === 7), true);
  assert.equal(sprints[8].endDate, "2026-09-06");
});

// Composition: capacity derived from a generated sprint + settings
test("sprintCapacity returns adjusted for full sprints, prorated for the partial", () => {
  const settings = {
    startDate: "2026-07-06",
    durationMonths: 3,
    sprintWeeks: 2,
    velocity: 20,
    bufferPct: 10,
  };
  const sprints = generateSprints(settings);
  assert.equal(sprintCapacity(sprints[0], settings), 18); // full
  assert.equal(sprintCapacity(sprints[6], settings), 12); // partial 9/14
});
