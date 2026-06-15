// @ts-check
/**
 * Phase 2 multiplayer spike — case 7 (auth + company scope at the ws boundary)
 * and the end-to-end two-client proof over a real socket: an op round-trips and
 * broadcasts with a version; a rejected op nacks the SENDER only; and the
 * EDIT_STORY clobber (case 5) is caught over the wire from two real clients.
 *
 * The exhaustive, deterministic conflict proof (cases 1-6) is in
 * spike-op-loop.test.js; this file proves the transport, auth, and broadcast.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";

import { reduce, createInitialState } from "../public/js/store.js";
import { openDb, createRoom } from "../server/db.js";
import { startSpikeServer } from "../server/server.js";
import { registerTestSession } from "../server/auth-seam.js";

let db, server, base;

before(async () => {
  db = openDb(":memory:");
  // company-only room, seeded with one story S1 for the edit-collision case.
  const doc = reduce(createInitialState("2026-01-05"), {
    type: "ADD_STORY", payload: { id: "S1", title: "orig", summary: "", points: 3, epicId: null },
  });
  createRoom(db, { id: "acme-q3", companyId: "acme", shareToken: "tok-q3", mode: "company-only", doc });
  createRoom(db, { id: "acme-open", companyId: "acme", shareToken: "share123", mode: "open-link", doc: createInitialState("2026-01-05") });

  registerTestSession("acme-tok", { userId: "u1", company: "acme", entitled: true });
  registerTestSession("globex-tok", { userId: "u2", company: "globex", entitled: true });

  server = await startSpikeServer({ db, port: 0 });
  base = server.url;
});

after(() => { server.close(); db.close(); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Connect; resolve {ws, state} on open (after the first state frame) or {refused} on a non-101. */
function connect(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(base + path, { headers });
    ws._frames = [];
    ws.on("message", (d) => ws._frames.push(JSON.parse(d.toString())));
    ws.on("unexpected-response", (_req, res) => resolve({ refused: res.statusCode }));
    ws.on("error", () => { /* refusal surfaces via unexpected-response */ });
    ws.on("open", async () => { await wait(30); resolve({ ws, state: ws._frames.find((f) => f.type === "state") }); });
    setTimeout(() => reject(new Error("connect timeout: " + path)), 2000);
  });
}

const send = (ws, msg) => ws.send(JSON.stringify(msg));
const opFrames = (ws) => ws._frames.filter((f) => f.type === "op");
const nackFrames = (ws) => ws._frames.filter((f) => f.type === "nack");

// ---- Case 7: auth + company scope at the boundary -------------------------

test("7a: company-only upgrade with NO session is refused", async () => {
  const r = await connect("?room=acme-q3");
  assert.equal(r.refused, 401);
});

test("7b: company-only upgrade with a DIFFERENT company's session is refused (no cross-company leak)", async () => {
  const r = await connect("?room=acme-q3", { "x-spike-session": "globex-tok" });
  assert.equal(r.refused, 403);
});

test("7c: open-link join with the share token + a claimed name connects as 'claimed'", async () => {
  const { ws, state } = await connect("?room=acme-open&token=share123&name=Guest");
  assert.ok(ws, "should connect");
  assert.equal(state.identity, "claimed");
  ws.close();
});

test("7d: company-only join with a valid member session connects as 'verified'", async () => {
  const { ws, state } = await connect("?room=acme-q3", { "x-spike-session": "acme-tok" });
  assert.ok(ws);
  assert.equal(state.identity, "verified");
  ws.close();
});

test("7e: open-link join with the WRONG share token is refused", async () => {
  const r = await connect("?room=acme-open&token=nope&name=Guest");
  assert.equal(r.refused, 403);
});

// ---- End-to-end transport + broadcast -------------------------------------

test("an op round-trips and broadcasts to both clients with a version", async () => {
  const A = await connect("?room=acme-q3", { "x-spike-session": "acme-tok" });
  const B = await connect("?room=acme-q3", { "x-spike-session": "acme-tok" });
  const base0 = A.state.version;

  send(A.ws, { type: "op", opId: "o1", op: { type: "ADD_STORY", payload: { id: "S2", title: "new", summary: "", points: 5, epicId: null } }, baseVersion: base0 });
  await wait(120);

  const fa = opFrames(A.ws).find((f) => f.opId === "o1");
  const fb = opFrames(B.ws).find((f) => f.opId === "o1");
  assert.ok(fa && fb, "both clients receive the broadcast");
  assert.equal(fa.version, base0 + 1);
  assert.equal(fb.version, base0 + 1);
  A.ws.close(); B.ws.close();
});

test("a rejected op nacks the SENDER only; other clients are untouched", async () => {
  const A = await connect("?room=acme-q3", { "x-spike-session": "acme-tok" });
  const B = await connect("?room=acme-q3", { "x-spike-session": "acme-tok" });

  // points must be >= 1; 0 fails validatePlan.
  send(A.ws, { type: "op", opId: "bad1", op: { type: "ADD_STORY", payload: { id: "Sx", title: "x", summary: "", points: 0, epicId: null } }, baseVersion: A.state.version });
  await wait(120);

  const na = nackFrames(A.ws).find((f) => f.opId === "bad1");
  assert.ok(na, "sender receives a nack");
  assert.match(na.reason, /points/);
  assert.equal(opFrames(B.ws).some((f) => f.opId === "bad1"), false, "other client sees no broadcast");
  assert.equal(nackFrames(B.ws).length, 0, "other client sees no nack");
  A.ws.close(); B.ws.close();
});

test("case 5 over the wire: two concurrent EDIT_STORY — one wins, one is nacked stale", async () => {
  const A = await connect("?room=acme-q3", { "x-spike-session": "acme-tok" });
  const B = await connect("?room=acme-q3", { "x-spike-session": "acme-tok" });
  const v = A.state.version; // both edit against the same base version

  send(A.ws, { type: "op", opId: "ea", op: { type: "EDIT_STORY", payload: { id: "S1", title: "fromA", summary: "", points: 3, epicId: null } }, baseVersion: v });
  send(B.ws, { type: "op", opId: "eb", op: { type: "EDIT_STORY", payload: { id: "S1", title: "fromB", summary: "", points: 3, epicId: null } }, baseVersion: v });
  await wait(150);

  // Exactly one EDIT was accepted (broadcast to all); the other sender was nacked stale.
  const accepted = [...opFrames(A.ws), ...opFrames(B.ws)].filter((f) => f.opId === "ea" || f.opId === "eb");
  const acceptedIds = new Set(accepted.map((f) => f.opId));
  assert.equal(acceptedIds.size, 1, "exactly one edit accepted");

  const loserId = acceptedIds.has("ea") ? "eb" : "ea";
  const loserWs = loserId === "ea" ? A.ws : B.ws;
  const nack = nackFrames(loserWs).find((f) => f.opId === loserId);
  assert.ok(nack, "the losing edit is nacked");
  assert.match(nack.reason, /stale/);
  A.ws.close(); B.ws.close();
});
