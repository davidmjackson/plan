// @ts-check
/**
 * Phase 2 multiplayer spike — the conflict/data-loss PROOF at the op-loop level
 * (cases 1-6 of docs/phase2-multiplayer-spike-build-brief.md). These drive ops
 * DIRECTLY through applyOp against a real better-sqlite3 store, in controlled
 * arrival order (the brief's "drive ops directly" option), then RELOAD the
 * persisted row and re-run validatePlan. Because Node serialises ws messages
 * through the same single thread applyOp runs on, controlled arrival order here
 * is faithful to the over-the-wire behaviour — and removes network
 * nondeterminism from the conflict proof. Case 7 (auth/company boundary) and an
 * end-to-end two-client check live in spike-multiplayer.test.js.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

import { reduce, createInitialState } from "../public/js/store.js";
import { validatePlan } from "../public/js/plan-io.js";
import { openDb, createRoom, loadRoom } from "../spike/db.js";
import { applyOp } from "../spike/rooms.js";

let dbCounter = 0;
/** Fresh on-disk db per test (case 4 needs reopen), auto-cleaned. */
function freshDb() {
  const path = join(tmpdir(), `spike-op-${process.pid}-${dbCounter++}.db`);
  const db = openDb(path);
  return { db, path, cleanup: () => { db.close(); rmSync(path, { force: true }); } };
}

/** Build a starting plan doc by reducing seed actions directly (setup, not under test). */
function seedDoc(actions = []) {
  let doc = createInitialState("2026-01-05");
  for (const a of actions) doc = reduce(doc, a);
  return doc;
}

const addStory = (id, fields = {}) => ({
  type: "ADD_STORY",
  payload: { id, title: id, summary: "", points: 3, epicId: null, ...fields },
});

/** A room seeded into the db at version 0. */
function seedRoom(db, doc) {
  createRoom(db, { id: "acme-q3", companyId: "acme", shareToken: "tok", mode: "company-only", doc });
  return loadRoom(db, "acme-q3");
}

test("case 1: same-story concurrent move converges to one placement", () => {
  const { db, cleanup } = freshDb();
  try {
    const room = seedRoom(db, seedDoc([addStory("S1")])); // S1 in backlog
    const v0 = room.version;

    const a = applyOp(db, room, { type: "MOVE_STORY", payload: { storyId: "S1", target: { kind: "sprint", index: 0 }, beforeId: null }, baseVersion: v0 });
    const b = applyOp(db, room, { type: "MOVE_STORY", payload: { storyId: "S1", target: { kind: "sprint", index: 1 }, beforeId: null }, baseVersion: v0 });

    assert.equal(a.ok, true);
    assert.equal(b.ok, true);

    const reloaded = loadRoom(db, "acme-q3").doc;
    assert.equal(validatePlan(reloaded).ok, true, "persisted doc must validate");
    // Exactly one placement, the last move wins, never duplicated, never in backlog.
    assert.equal(reloaded.backlog.includes("S1"), false);
    assert.equal(reloaded.sprints[0].placedStoryIds.includes("S1"), false);
    assert.equal(reloaded.sprints[1].placedStoryIds.filter((/** @type {string} */ s) => s === "S1").length, 1);
  } finally { cleanup(); }
});

test("case 2a: dep-add THEN blocker-delete prunes the pair (no dangling dep)", () => {
  const { db, cleanup } = freshDb();
  try {
    const room = seedRoom(db, seedDoc([addStory("S1"), addStory("S2")]));

    const link = applyOp(db, room, { type: "LINK_DEP", payload: { id: "D1", blockerId: "S1", blockedId: "S2" }, baseVersion: room.version });
    assert.equal(link.ok, true);
    const del = applyOp(db, room, { type: "DELETE_STORY", payload: { id: "S1" }, baseVersion: room.version });
    assert.equal(del.ok, true);

    const reloaded = loadRoom(db, "acme-q3").doc;
    assert.equal(validatePlan(reloaded).ok, true);
    assert.equal(reloaded.deps.length, 0, "dep referencing deleted story must be pruned");
  } finally { cleanup(); }
});

test("case 2b: blocker-delete THEN dep-add is rejected (validatePlan catches dangling)", () => {
  const { db, cleanup } = freshDb();
  try {
    const room = seedRoom(db, seedDoc([addStory("S1"), addStory("S2")]));

    const del = applyOp(db, room, { type: "DELETE_STORY", payload: { id: "S1" }, baseVersion: room.version });
    assert.equal(del.ok, true);
    const link = applyOp(db, room, { type: "LINK_DEP", payload: { id: "D1", blockerId: "S1", blockedId: "S2" }, baseVersion: room.version });
    assert.equal(link.ok, false, "linking to a deleted story must be rejected");
    assert.match(link.reason, /unknown story/);

    const reloaded = loadRoom(db, "acme-q3").doc;
    assert.equal(validatePlan(reloaded).ok, true);
    assert.equal(reloaded.deps.length, 0, "no dangling dep persisted");
  } finally { cleanup(); }
});

test("case 3: concurrent reorder converges to a single order, no loss/dup", () => {
  const { db, cleanup } = freshDb();
  try {
    // Three stories placed in sprint 0 in order A,B,C.
    let doc = seedDoc([addStory("A"), addStory("B"), addStory("C")]);
    for (const id of ["A", "B", "C"]) {
      doc = reduce(doc, { type: "MOVE_STORY", payload: { storyId: id, target: { kind: "sprint", index: 0 }, beforeId: null } });
    }
    const room = seedRoom(db, doc);
    const v0 = room.version;

    // Two concurrent reorders within the sprint.
    applyOp(db, room, { type: "MOVE_STORY", payload: { storyId: "C", target: { kind: "sprint", index: 0 }, beforeId: "A" }, baseVersion: v0 });
    applyOp(db, room, { type: "MOVE_STORY", payload: { storyId: "B", target: { kind: "sprint", index: 0 }, beforeId: "A" }, baseVersion: v0 });

    const reloaded = loadRoom(db, "acme-q3").doc;
    assert.equal(validatePlan(reloaded).ok, true);
    const order = reloaded.sprints[0].placedStoryIds;
    assert.deepEqual([...order].sort(), ["A", "B", "C"], "no story lost or duplicated");
    assert.equal(order.length, 3);
  } finally { cleanup(); }
});

test("case 4: crash mid-flight — reopened db reflects exactly the acked ops", () => {
  const { db, path, cleanup } = freshDb();
  try {
    const room = seedRoom(db, seedDoc([addStory("S1")]));
    applyOp(db, room, { type: "MOVE_STORY", payload: { storyId: "S1", target: { kind: "sprint", index: 0 }, beforeId: null }, baseVersion: room.version });
    const ackedVersion = room.version;
    const ackedDoc = room.doc;
    db.close(); // simulate crash

    const db2 = openDb(path); // restart
    const recovered = loadRoom(db2, "acme-q3");
    assert.equal(recovered.version, ackedVersion, "persisted version == last acked");
    assert.deepEqual(recovered.doc, ackedDoc, "persisted doc == last acked doc");
    assert.equal(validatePlan(recovered.doc).ok, true);
    db2.close();
  } finally { cleanup(); }
});

test("case 5: stale EDIT_STORY is rejected — the winner is not clobbered", () => {
  const { db, cleanup } = freshDb();
  try {
    const room = seedRoom(db, seedDoc([addStory("S1", { title: "orig" })]));
    const base = room.version;

    const a = applyOp(db, room, { type: "EDIT_STORY", payload: { id: "S1", title: "A", summary: "", points: 3, epicId: null }, baseVersion: base });
    assert.equal(a.ok, true);
    // B edited against the now-stale base version.
    const b = applyOp(db, room, { type: "EDIT_STORY", payload: { id: "S1", title: "B", summary: "", points: 3, epicId: null }, baseVersion: base });
    assert.equal(b.ok, false, "stale edit must be rejected");
    assert.match(b.reason, /stale/);

    const reloaded = loadRoom(db, "acme-q3").doc;
    assert.equal(reloaded.stories.S1.title, "A", "A's edit survives; B did not silently clobber");
    // A fresh (non-stale) edit succeeds.
    const c = applyOp(db, room, { type: "EDIT_STORY", payload: { id: "S1", title: "C", summary: "", points: 3, epicId: null }, baseVersion: room.version });
    assert.equal(c.ok, true);
    assert.equal(loadRoom(db, "acme-q3").doc.stories.S1.title, "C");
  } finally { cleanup(); }
});

test("case 6: an op that fails validatePlan is rejected; version & doc unchanged", () => {
  const { db, cleanup } = freshDb();
  try {
    const room = seedRoom(db, seedDoc([addStory("S1")]));
    const before = loadRoom(db, "acme-q3");

    // points must be a positive integer; 0 fails validatePlan.
    const bad = applyOp(db, room, { type: "ADD_STORY", payload: { id: "S2", title: "bad", summary: "", points: 0, epicId: null }, baseVersion: room.version });
    assert.equal(bad.ok, false);
    assert.match(bad.reason, /points/);

    const after = loadRoom(db, "acme-q3");
    assert.equal(after.version, before.version, "rejected op must not bump version");
    assert.deepEqual(after.doc, before.doc, "rejected op must not mutate the persisted doc");
  } finally { cleanup(); }
});

test("vocabulary guard: an excluded op type is rejected, never applied", () => {
  const { db, cleanup } = freshDb();
  try {
    const room = seedRoom(db, seedDoc([addStory("S1")]));
    for (const type of ["SET_VELOCITY", "NEW_PLAN", "LOAD_PLAN", "BOGUS"]) {
      const r = applyOp(db, room, { type, payload: {}, baseVersion: room.version });
      assert.equal(r.ok, false, `${type} must be rejected`);
      assert.match(r.reason, /not allowed/);
    }
    assert.equal(validatePlan(loadRoom(db, "acme-q3").doc).ok, true);
  } finally { cleanup(); }
});
