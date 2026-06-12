// @ts-check
/**
 * Pure capacity and sprint-generation maths for sprintplan.
 *
 * Every function here is DOM-free and unit-tested. Capacity is always DERIVED
 * from settings + sprint date facts; it is never stored. Days are CALENDAR
 * days throughout (see ./date.js).
 */

import { addDays, addMonths, daysInclusive } from "./date.js";

/**
 * @typedef {Object} PlanSettings
 * @property {string} startDate      ISO YYYY-MM-DD
 * @property {number} durationMonths 1-3
 * @property {number} sprintWeeks    1-4
 * @property {number} velocity
 * @property {number} bufferPct
 */

/**
 * @typedef {Object} Sprint
 * @property {number} index      0-based; identity is by index (G3)
 * @property {string} name       "Sprint 1", "Sprint 2", ...
 * @property {string} startDate  ISO
 * @property {string} endDate    ISO (inclusive)
 * @property {number} days       inclusive calendar-day span
 * @property {boolean} isPartial true when truncated at plan end
 */

/**
 * Adjusted capacity = round(velocity * (1 - buffer/100)), minimum 1.
 * @param {number} velocity
 * @param {number} bufferPct
 * @returns {number}
 */
export function adjustedCapacity(velocity, bufferPct) {
  return Math.max(1, Math.round(velocity * (1 - bufferPct / 100)));
}

/**
 * Partial-sprint capacity = round(adjusted * partialDays / fullDays), min 1.
 * @param {number} adjusted
 * @param {number} partialDays
 * @param {number} fullDays
 * @returns {number}
 */
export function proratedCapacity(adjusted, partialDays, fullDays) {
  return Math.max(1, Math.round((adjusted * partialDays) / fullDays));
}

/**
 * Capacity for one sprint: adjusted for a full sprint, prorated for a partial.
 * @param {Sprint} sprint
 * @param {PlanSettings} settings
 * @returns {number}
 */
export function sprintCapacity(sprint, settings) {
  const adjusted = adjustedCapacity(settings.velocity, settings.bufferPct);
  if (!sprint.isPartial) return adjusted;
  return proratedCapacity(adjusted, sprint.days, settings.sprintWeeks * 7);
}

/**
 * Pill state from placed total vs capacity. Thresholds are computed against
 * the (adjusted or prorated) capacity: at/under = neutral, up to and including
 * 10% over = amber, more than 10% over = red.
 * @param {number} placed
 * @param {number} capacity
 * @returns {"neutral"|"amber"|"red"}
 */
export function pillState(placed, capacity) {
  if (placed <= capacity) return "neutral";
  const overPct = ((placed - capacity) / capacity) * 100;
  return overPct <= 10 ? "amber" : "red";
}

/**
 * Overshoot in points: how far a sprint's placed total exceeds its capacity, or
 * 0 when at/under. This is the honesty banner's N AND its visibility predicate —
 * `overBy(p, c) > 0` is provably identical to `pillState(p, c) !== "neutral"`,
 * so the banner can never disagree with the pill. Never negative.
 * @param {number} placed
 * @param {number} capacity
 * @returns {number}
 */
export function overBy(placed, capacity) {
  return Math.max(0, placed - capacity);
}

/**
 * Generate sprint containers from plan settings. Sprints are laid back-to-back
 * from the start date, each (sprintWeeks * 7) calendar days. Plan end =
 * startDate + durationMonths (day-of-month overflow clamped). The final sprint
 * is truncated at plan end and marked partial; if the plan divides evenly there
 * is no partial.
 * @param {PlanSettings} settings
 * @returns {Sprint[]}
 */
export function generateSprints(settings) {
  const sprintDays = settings.sprintWeeks * 7;
  const planEnd = addMonths(settings.startDate, settings.durationMonths);
  const planDays = daysInclusive(settings.startDate, planEnd);
  const count = Math.ceil(planDays / sprintDays);

  /** @type {Sprint[]} */
  const sprints = [];
  for (let k = 0; k < count; k++) {
    const startDate = addDays(settings.startDate, k * sprintDays);
    const fullEnd = addDays(startDate, sprintDays - 1);
    // Truncate the final sprint at plan end.
    const endDate = daysInclusive(fullEnd, planEnd) >= 1 ? fullEnd : planEnd;
    const days = daysInclusive(startDate, endDate);
    sprints.push({
      index: k,
      name: `Sprint ${k + 1}`,
      startDate,
      endDate,
      days,
      isPartial: days < sprintDays,
    });
  }
  return sprints;
}
