// @ts-check
/**
 * Pure month-rail computation. The rail is a visual artefact only: never a drop
 * target, holds no data. A sprint is assigned to the month holding the majority
 * of its calendar days; on a tie the earlier month wins.
 */

import { parseISO, toISO, daysInMonth, daysInclusive } from "./date.js";
import { addMonths } from "./date.js";

const MONTH_LABELS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/**
 * @param {number} y
 * @param {number} m  1-12
 */
function monthKey(y, m) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * The month (YYYY-MM) holding the majority of the inclusive [startDate, endDate]
 * span. ISO date strings compare chronologically as plain strings, so we use
 * string min/max for the per-month overlap window. Ties resolve to the earlier
 * month because we only replace the winner on a strictly greater count.
 * @param {string} startDate ISO
 * @param {string} endDate   ISO (inclusive, >= startDate)
 * @returns {string} "YYYY-MM"
 */
export function dominantMonth(startDate, endDate) {
  const a = parseISO(startDate);
  const b = parseISO(endDate);
  let cursor = toISO({ y: a.y, m: a.m, d: 1 });
  const lastMonthStart = toISO({ y: b.y, m: b.m, d: 1 });

  let bestKey = monthKey(a.y, a.m);
  let bestDays = 0;
  while (cursor <= lastMonthStart) {
    const { y, m } = parseISO(cursor);
    const monthFirst = cursor;
    const monthLast = toISO({ y, m, d: daysInMonth(y, m) });
    const overlapStart = startDate > monthFirst ? startDate : monthFirst;
    const overlapEnd = endDate < monthLast ? endDate : monthLast;
    const days = Math.max(0, daysInclusive(overlapStart, overlapEnd));
    if (days > bestDays) {
      bestDays = days;
      bestKey = monthKey(y, m);
    }
    cursor = addMonths(cursor, 1);
  }
  return bestKey;
}

/**
 * @typedef {Object} MonthSegment
 * @property {string} monthKey   "YYYY-MM"
 * @property {string} label      "JUL"
 * @property {number[]} sprintIndexes  in order
 */

/**
 * Group sprints into ordered rail segments by their dominant month.
 * @param {import("./plan-maths.js").Sprint[]} sprints
 * @returns {MonthSegment[]}
 */
export function assignSprintsToMonths(sprints) {
  /** @type {MonthSegment[]} */
  const segments = [];
  for (const sprint of sprints) {
    const key = dominantMonth(sprint.startDate, sprint.endDate);
    let segment = segments.find((s) => s.monthKey === key);
    if (!segment) {
      const { m } = parseISO(`${key}-01`);
      segment = { monthKey: key, label: MONTH_LABELS[m - 1], sprintIndexes: [] };
      segments.push(segment);
    }
    segment.sprintIndexes.push(sprint.index);
  }
  return segments;
}
