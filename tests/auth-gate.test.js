// tests/auth-gate.test.js
// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideEntry } from "../public/js/auth-gate.js";

test("a room link always takes the room path, whatever the session", () => {
  for (const session of ["authed", "anon", "no-auth-system", "error"]) {
    assert.equal(decideEntry({ hasRoomLink: true, session }).mode, "room");
  }
});
test("room link + suite session => room, hasSuiteSession true", () => {
  const r = decideEntry({ hasRoomLink: true, session: "authed" });
  assert.equal(r.mode, "room");
  assert.equal(r.hasSuiteSession, true);
});
test("room link + no session => room as a guest (hasSuiteSession false)", () => {
  assert.equal(decideEntry({ hasRoomLink: true, session: "anon" }).hasSuiteSession, false);
});
test("no link + authed => single-user with a suite session", () => {
  const r = decideEntry({ hasRoomLink: false, session: "authed" });
  assert.equal(r.mode, "single-user");
  assert.equal(r.hasSuiteSession, true);
});
test("no link + no auth system (dev/stub) => single-user, no suite session", () => {
  const r = decideEntry({ hasRoomLink: false, session: "no-auth-system" });
  assert.equal(r.mode, "single-user");
  assert.equal(r.hasSuiteSession, false);
});
test("no link + anon => redirect (locked down)", () => {
  assert.equal(decideEntry({ hasRoomLink: false, session: "anon" }).mode, "redirect");
});
test("no link + whoami error => redirect (fail closed)", () => {
  assert.equal(decideEntry({ hasRoomLink: false, session: "error" }).mode, "redirect");
});
