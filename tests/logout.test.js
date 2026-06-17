// tests/logout.test.js
// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideLogout } from "../public/js/logout.js";

test("a suite session logs out as a suite user (=> dashboard)", () => {
  assert.equal(decideLogout({ hasSuiteSession: true }).kind, "suite");
});
test("no suite session logs out as a guest (=> landing, with modal)", () => {
  assert.equal(decideLogout({ hasSuiteSession: false }).kind, "guest");
});
