// @ts-check
/**
 * Pure calendar-date helpers for sprintplan.
 *
 * Plan dates are CALENDAR days with no time component, so we never touch the
 * JS `Date` object (timezone/DST footguns, silent month overflow). Dates are
 * ISO `YYYY-MM-DD` strings, manipulated as integer {y, m, d} triples.
 */

/** @typedef {{ y: number, m: number, d: number }} YMD  m is 1-12, d is 1-31 */

/**
 * @param {string} iso
 * @returns {YMD}
 */
export function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/**
 * @param {YMD} ymd
 * @returns {string}
 */
export function toISO({ y, m, d }) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * @param {number} y
 * @returns {boolean}
 */
function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * @param {number} y
 * @param {number} m  1-12
 * @returns {number}
 */
export function daysInMonth(y, m) {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/**
 * Convert a calendar date to a day count since an epoch, for pure integer
 * arithmetic. Uses the proleptic Gregorian "days from civil" algorithm
 * (Howard Hinnant), which is exact and timezone-free.
 * @param {YMD} ymd
 * @returns {number}
 */
function toOrdinal({ y, m, d }) {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/**
 * Inverse of toOrdinal.
 * @param {number} z
 * @returns {YMD}
 */
function fromOrdinal(z) {
  z += 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? y + 1 : y, m, d };
}

/**
 * @param {string} iso
 * @param {number} n
 * @returns {string}
 */
export function addDays(iso, n) {
  return toISO(fromOrdinal(toOrdinal(parseISO(iso)) + n));
}

/**
 * Advance by calendar months, clamping day-of-month overflow to the target
 * month's last valid day (e.g. Jan 31 + 1 month -> Feb 28/29).
 * @param {string} iso
 * @param {number} n
 * @returns {string}
 */
export function addMonths(iso, n) {
  const { y, m, d } = parseISO(iso);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return toISO({ y: ny, m: nm, d: nd });
}

/**
 * Number of calendar days from isoA to isoB, counting both endpoints.
 * Requires isoB >= isoA.
 * @param {string} isoA
 * @param {string} isoB
 * @returns {number}
 */
export function daysInclusive(isoA, isoB) {
  return toOrdinal(parseISO(isoB)) - toOrdinal(parseISO(isoA)) + 1;
}

/**
 * ISO weekday: 1 = Monday .. 7 = Sunday. (Ordinal 0 = 1970-01-01, a Thursday.)
 * @param {string} iso
 * @returns {number}
 */
export function isoWeekday(iso) {
  const ord = toOrdinal(parseISO(iso));
  return ((((ord + 3) % 7) + 7) % 7) + 1;
}

/**
 * The first Monday strictly after the given day. Used for the default plan
 * start date (G1).
 * @param {string} iso
 * @returns {string}
 */
export function nextMonday(iso) {
  const delta = ((8 - isoWeekday(iso)) % 7) || 7;
  return addDays(iso, delta);
}

/**
 * Human "Last edited" string for the resume card (Brief 6, R7). PURE: "now" is
 * an argument, so it is clock-free and unit-testable. Minutes and hours are
 * ELAPSED time (the truly-recent buckets); yesterday and N-days are CALENDAR-day
 * differences, so a sub-24h save that crossed midnight reads "yesterday", not
 * "N hours ago" (the seam pinned in the unit net). Past the 14-day bound it
 * falls back to the absolute ISO date. A missing/invalid timestamp (a legacy
 * bare save with no savedAt) returns "unknown" and never throws.
 * @param {string | undefined | null} fromISO  the savedAt timestamp
 * @param {string} nowISO  the current instant, supplied by the caller
 * @returns {string}
 */
export function relativeTime(fromISO, nowISO) {
  if (!fromISO || typeof fromISO !== "string") return "unknown";
  const fromMs = Date.parse(fromISO);
  const nowMs = Date.parse(nowISO);
  if (Number.isNaN(fromMs) || Number.isNaN(nowMs)) return "unknown";

  const elapsedSec = Math.floor((nowMs - fromMs) / 1000);
  if (elapsedSec < 60) return "just now";
  const minutes = Math.floor(elapsedSec / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  // Day-scale buckets are CALENDAR-day differences, not elapsed/86400 (so a
  // save 3 hours ago across midnight is "yesterday", not "3 hours ago").
  const days = toOrdinal(parseISO(nowISO.slice(0, 10))) - toOrdinal(parseISO(fromISO.slice(0, 10)));
  if (days <= 0) {
    const hours = Math.floor(elapsedSec / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return `on ${fromISO.slice(0, 10)}`;
}
