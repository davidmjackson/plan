// @ts-check
/**
 * Productionise slice 4 — the collaborate bridge (server side). POST /rooms can
 * seed a room from the CURRENT plan ("import my plan into a room"), validated by
 * the existing validatePlan. Driven against the default stub auth.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { openDb, loadRoom } from "../server/db.js";
import { startSpikeServer } from "../server/server.js";
import { registerTestSession } from "../server/auth-seam.js";
import { reduce, createInitialState } from "../public/js/store.js";

let db, server;

before(async () => {
  db = openDb(":memory:");
  registerTestSession("mgr", { userId: "m1", company: "acme", entitled: true });
  server = await startSpikeServer({ db, port: 0 });
});
after(() => { server.close(); db.close(); });

async function postRoom(token, body) {
  const res = await fetch(`${server.url.replace(/^ws/, "http")}/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { "x-spike-session": token } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: res.ok ? await res.json() : null };
}

/** A populated, valid plan (a story placed in sprint 0). */
function populatedPlan() {
  let doc = reduce(createInitialState("2026-01-05"), { type: "ADD_STORY", payload: { id: "S1", title: "Imported", summary: "", points: 5, epicId: null } });
  doc = reduce(doc, { type: "MOVE_STORY", payload: { storyId: "S1", target: { kind: "sprint", index: 0 }, beforeId: null } });
  return { ...doc, lastReturnedStoryIds: ["stale"] }; // transient field should be normalised away
}

test("POST /rooms with a valid plan seeds the room with that plan (import)", async () => {
  const plan = populatedPlan();
  const { status, json } = await postRoom("mgr", { mode: "open-link", plan });
  assert.equal(status, 200);

  const room = loadRoom(db, json.id);
  assert.equal(room.companyId, "acme", "company from session, not body (R2)");
  assert.ok("S1" in room.doc.stories, "imported story present");
  assert.equal(room.doc.sprints[0].placedStoryIds.includes("S1"), true, "imported placement preserved");
  assert.deepEqual(room.doc.lastReturnedStoryIds, [], "transient field normalised (R1)");
});

test("POST /rooms with a structurally invalid plan is rejected 400, no room created", async () => {
  const { status, json } = await postRoom("mgr", { mode: "open-link", plan: { meta: { schemaVersion: 2 } } });
  assert.equal(status, 400);
  assert.equal(json, null);
});

test("POST /rooms with no plan still seeds an empty plan (regression)", async () => {
  const { status, json } = await postRoom("mgr", { mode: "company-only" });
  assert.equal(status, 200);
  const room = loadRoom(db, json.id);
  assert.deepEqual(room.doc.stories, {}, "empty starting plan");
  assert.equal(room.doc.backlog.length, 0);
});
