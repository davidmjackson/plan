// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveJoinName, buildInviteUrl } from "../public/js/room-join.js";

// --- phase2-build4 #3: resolveJoinName — the name-gate seam ------------------
// Decides {name, needsPrompt} from the raw ?name= param. "" / "guest" (the
// sentinel default) / null all need the blocking prompt; a real name trims and
// passes. Pure, the unit-tested seam the room boot waits on.

test("resolveJoinName: empty / null / missing => needsPrompt", () => {
  assert.deepEqual(resolveJoinName(""), { name: "", needsPrompt: true });
  assert.deepEqual(resolveJoinName(null), { name: "", needsPrompt: true });
  assert.deepEqual(resolveJoinName(undefined), { name: "", needsPrompt: true });
  assert.deepEqual(resolveJoinName("   "), { name: "", needsPrompt: true }); // whitespace only
});

test("resolveJoinName: the 'guest' sentinel => needsPrompt (case-insensitive)", () => {
  assert.deepEqual(resolveJoinName("guest"), { name: "", needsPrompt: true });
  assert.deepEqual(resolveJoinName("  guest  "), { name: "", needsPrompt: true });
  assert.deepEqual(resolveJoinName("Guest"), { name: "", needsPrompt: true });
});

test("resolveJoinName: a real name trims and passes (no prompt)", () => {
  assert.deepEqual(resolveJoinName("  Dave  "), { name: "Dave", needsPrompt: false });
  assert.deepEqual(resolveJoinName("Ada Lovelace"), { name: "Ada Lovelace", needsPrompt: false });
});

// --- phase2-build4 #1: buildInviteUrl — re-openable share link --------------
// Reconstructs the invite from room + token only; token present => open-link
// style, absent => company-only. Personal params (name, etc.) are NEVER read,
// so they can never leak into a shared link.

test("buildInviteUrl: token present => /?room=R&token=T", () => {
  assert.equal(buildInviteUrl("https://x.uk", { room: "R", token: "T" }), "https://x.uk/?room=R&token=T");
});

test("buildInviteUrl: no token => /?room=R (company-only style)", () => {
  assert.equal(buildInviteUrl("https://x.uk", { room: "R" }), "https://x.uk/?room=R");
});

test("buildInviteUrl: a name (or any personal param) in the source is stripped", () => {
  const withName = buildInviteUrl("https://x.uk", { room: "R", token: "T", name: "Dave" });
  assert.equal(withName, "https://x.uk/?room=R&token=T");
  assert.ok(!withName.includes("name="));
  assert.ok(!withName.includes("Dave"));
});

test("buildInviteUrl: room id and token are URL-encoded", () => {
  assert.equal(
    buildInviteUrl("https://x.uk", { room: "acme room/1", token: "a b" }),
    "https://x.uk/?room=acme%20room%2F1&token=a%20b",
  );
});
