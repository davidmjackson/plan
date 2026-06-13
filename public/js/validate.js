// @ts-check
/**
 * Pure field validators for the editors. The editor gates Save on these; the
 * reducer trusts validated payloads (same boundary as Brief 1).
 */

/**
 * The single points rule: positive integer (>= 1). The one authority both the
 * editor coercer (parsePoints) and the load-boundary validator (validatePlan)
 * consume, so a drifting second threshold can't exist.
 * @param {unknown} n
 * @returns {boolean}
 */
export function isValidPoints(n) {
  return Number.isInteger(n) && /** @type {number} */ (n) >= 1;
}

/**
 * Coerce editor input to a valid points value, or null if invalid. Points are
 * positive integers (>= 1): rejects 0, negatives, non-integers and empties.
 * @param {unknown} input
 * @returns {number | null}
 */
export function parsePoints(input) {
  if (typeof input === "string" && input.trim() === "") return null;
  const n = Number(input);
  return isValidPoints(n) ? n : null;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonEmptyTitle(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Normalise an edited plan title to a single line: collapse every run of
 * whitespace — including the newlines a contenteditable inserts on Enter or a
 * multi-line paste — to one space, then trim. The band renders the title on one
 * line, so the stored value is kept one line too. Pure; the DOM handler calls
 * this before dispatching setPlanTitle.
 * @param {string} raw
 * @returns {string}
 */
export function singleLineTitle(raw) {
  return String(raw).replace(/\s+/g, " ").trim();
}
