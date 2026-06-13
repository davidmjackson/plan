// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseISO,
  toISO,
  daysInMonth,
  addDays,
  addMonths,
  daysInclusive,
  isoWeekday,
  nextMonday,
  relativeTime,
} from "../public/js/date.js";

test("parseISO splits an ISO date into y/m/d integers", () => {
  assert.deepEqual(parseISO("2026-07-06"), { y: 2026, m: 7, d: 6 });
});

test("toISO zero-pads month and day", () => {
  assert.equal(toISO({ y: 2026, m: 7, d: 6 }), "2026-07-06");
  assert.equal(toISO({ y: 2026, m: 12, d: 31 }), "2026-12-31");
});

test("daysInMonth handles 30/31-day months", () => {
  assert.equal(daysInMonth(2026, 7), 31);
  assert.equal(daysInMonth(2026, 9), 30);
});

test("daysInMonth handles February in common and leap years", () => {
  assert.equal(daysInMonth(2026, 2), 28); // common year
  assert.equal(daysInMonth(2028, 2), 29); // leap year
  assert.equal(daysInMonth(2000, 2), 29); // divisible by 400
  assert.equal(daysInMonth(1900, 2), 28); // divisible by 100, not 400
});

test("addDays advances within and across month boundaries", () => {
  assert.equal(addDays("2026-07-06", 14), "2026-07-20"); // sprint 1 end-anchor
  assert.equal(addDays("2026-07-20", 14), "2026-08-03"); // crosses into August
  assert.equal(addDays("2026-12-31", 1), "2027-01-01"); // crosses year
});

test("addMonths advances by calendar months", () => {
  assert.equal(addMonths("2026-07-06", 3), "2026-10-06"); // plan end, default
  assert.equal(addMonths("2026-07-06", 1), "2026-08-06");
});

test("addMonths clamps day-of-month overflow to the target month's last day", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28"); // Feb, common year
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29"); // Feb, leap year
  assert.equal(addMonths("2026-08-31", 1), "2026-09-30"); // 31 -> 30-day month
});

test("isoWeekday returns 1=Mon .. 7=Sun", () => {
  assert.equal(isoWeekday("2026-07-06"), 1); // brief fixture: Mon 6 Jul 2026
  assert.equal(isoWeekday("2026-07-07"), 2); // Tue
  assert.equal(isoWeekday("2026-07-12"), 7); // Sun
});

test("nextMonday returns the first Monday strictly after the given day", () => {
  assert.equal(nextMonday("2026-07-06"), "2026-07-13"); // a Monday -> following Monday
  assert.equal(nextMonday("2026-07-07"), "2026-07-13"); // Tue -> coming Monday
  assert.equal(nextMonday("2026-07-12"), "2026-07-13"); // Sun -> next day
});

test("daysInclusive counts both endpoints", () => {
  assert.equal(daysInclusive("2026-07-06", "2026-07-06"), 1); // same day
  assert.equal(daysInclusive("2026-09-28", "2026-10-06"), 9); // brief: sprint 7
  assert.equal(daysInclusive("2026-08-03", "2026-08-06"), 4); // brief: 1-month sprint 3
  assert.equal(daysInclusive("2026-07-06", "2026-10-06"), 93); // brief: full 3-month plan
  assert.equal(daysInclusive("2026-07-06", "2026-08-06"), 32); // brief: full 1-month plan
});

// --- relativeTime: "Last edited" string (Brief 6, R7) ----------------------
// Pure: "now" is an argument so it is clock-free. Minutes/hours are ELAPSED
// time; yesterday/days are CALENDAR-day differences — the seam the review
// flagged (a sub-24h save that crossed midnight reads "yesterday", not hours).

const NOON = "2026-06-13T12:00:00.000Z";

test("relativeTime: same instant and sub-minute read 'just now'", () => {
  assert.equal(relativeTime(NOON, NOON), "just now");
  assert.equal(relativeTime("2026-06-13T11:59:30.000Z", NOON), "just now");
});

test("relativeTime: minutes bucket, with singular pinned", () => {
  assert.equal(relativeTime("2026-06-13T11:15:00.000Z", NOON), "45 minutes ago");
  assert.equal(relativeTime("2026-06-13T11:59:00.000Z", NOON), "1 minute ago");
});

test("relativeTime: hours bucket (same calendar day), with singular pinned", () => {
  assert.equal(relativeTime("2026-06-13T09:00:00.000Z", NOON), "3 hours ago");
  assert.equal(relativeTime("2026-06-13T11:00:00.000Z", NOON), "1 hour ago");
});

test("relativeTime: the hours->yesterday seam — a sub-24h save across midnight reads 'yesterday'", () => {
  // 3 hours ELAPSED but the previous calendar day: calendar wins over elapsed.
  assert.equal(relativeTime("2026-06-12T22:00:00.000Z", "2026-06-13T01:00:00.000Z"), "yesterday");
  // ...but minutes still win when sub-hour even across midnight (it's truly recent).
  assert.equal(relativeTime("2026-06-12T23:50:00.000Z", "2026-06-13T00:10:00.000Z"), "20 minutes ago");
});

test("relativeTime: yesterday is exactly one calendar day earlier", () => {
  assert.equal(relativeTime("2026-06-12T12:00:00.000Z", NOON), "yesterday");
});

test("relativeTime: days bucket, both sides of the 14-day absolute-date bound", () => {
  assert.equal(relativeTime("2026-06-08T12:00:00.000Z", NOON), "5 days ago");
  assert.equal(relativeTime("2026-05-31T12:00:00.000Z", NOON), "13 days ago"); // last day still relative
  assert.equal(relativeTime("2026-05-30T12:00:00.000Z", NOON), "on 2026-05-30"); // 14 days: absolute
});

test("relativeTime: a missing/invalid timestamp reads 'unknown' and never throws (legacy bare save)", () => {
  assert.equal(relativeTime(undefined, NOON), "unknown");
  assert.equal(relativeTime("", NOON), "unknown");
  assert.equal(relativeTime("not-a-date", NOON), "unknown");
});
