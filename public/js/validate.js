// @ts-check
/**
 * Pure field validators for the editors. The editor gates Save on these; the
 * reducer trusts validated payloads (same boundary as Brief 1).
 */

/**
 * Coerce editor input to a valid points value, or null if invalid. Points are
 * positive integers (>= 1): rejects 0, negatives, non-integers and empties.
 * @param {unknown} input
 * @returns {number | null}
 */
export function parsePoints(input) {
  if (typeof input === "string" && input.trim() === "") return null;
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonEmptyTitle(value) {
  return typeof value === "string" && value.trim().length > 0;
}
