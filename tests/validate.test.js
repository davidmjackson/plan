// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePoints, isNonEmptyTitle } from "../public/js/validate.js";

// Brief asserted case 8
test("parsePoints accepts positive integers", () => {
  assert.equal(parsePoints(1), 1);
  assert.equal(parsePoints(3), 3);
  assert.equal(parsePoints(8), 8);
  assert.equal(parsePoints(34), 34);
  assert.equal(parsePoints("5"), 5); // string input from a text field
});

test("parsePoints rejects 0, negatives, non-integers and empty as null", () => {
  assert.equal(parsePoints(0), null);
  assert.equal(parsePoints(-2), null);
  assert.equal(parsePoints(2.5), null);
  assert.equal(parsePoints(""), null);
  assert.equal(parsePoints("  "), null);
  assert.equal(parsePoints("abc"), null);
  assert.equal(parsePoints(null), null);
  assert.equal(parsePoints(undefined), null);
  assert.equal(parsePoints(NaN), null);
});

test("isNonEmptyTitle requires non-whitespace content", () => {
  assert.equal(isNonEmptyTitle("Checkout"), true);
  assert.equal(isNonEmptyTitle("  x  "), true);
  assert.equal(isNonEmptyTitle(""), false);
  assert.equal(isNonEmptyTitle("   "), false);
});
