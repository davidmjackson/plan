// @ts-check
/**
 * Productionise slice 2 — company-only rooms + the auth provider seam (plan-side).
 * Authed room CREATION (POST /rooms) scopes the room to the MANAGER's company;
 * join enforcement (already in decideUpgrade) is exercised through create->join.
 * Driven against the default STUB provider (no hub): sessions are injected via
 * registerTestSession and carried in the x-spike-session header.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";

import { openDb } from "../server/db.js";
import { startSpikeServer } from "../server/server.js";
import { registerTestSession } from "../server/auth-seam.js";
import { createAuthProvider } from "../server/auth.js";

let db, server;

before(async () => {
  db = openDb(":memory:");
  registerTestSession("mgr-acme", { userId: "m1", company: "acme", entitled: true });
  registerTestSession("mem-acme", { userId: "u2", company: "acme", entitled: true });
  registerTestSession("globex", { userId: "g1", company: "globex", entitled: true });
  server = await startSpikeServer({ db, port: 0 });
});
after(() => { server.close(); db.close(); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function postRoom(token, body) {
  const res = await fetch(`${server.httpUrl}/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { "x-spike-session": token } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: res.ok ? await res.json() : null };
}

function connect(roomId, token, sessionToken) {
  return new Promise((resolve, reject) => {
    const url = `${server.url}/?room=${roomId}&token=${token ?? ""}&name=Tester`;
    const ws = new WebSocket(url, sessionToken ? { headers: { "x-spike-session": sessionToken } } : {});
    const frames = [];
    ws.on("message", (d) => frames.push(JSON.parse(d.toString())));
    ws.on("unexpected-response", (_q, res) => resolve({ refused: res.statusCode }));
    ws.on("error", () => {});
    ws.on("open", async () => { await wait(30); resolve({ ws, state: frames.find((f) => f.type === "state") }); });
    setTimeout(() => reject(new Error("connect timeout")), 2000);
  });
}

test("POST /rooms with no session is refused (401)", async () => {
  const r = await postRoom(null, { mode: "company-only" });
  assert.equal(r.status, 401);
});

test("authed manager creates a company-only room scoped to THEIR company (client companyId ignored)", async () => {
  const r = await postRoom("mgr-acme", { mode: "company-only", companyId: "evil-injected" });
  assert.equal(r.status, 200);
  assert.equal(r.json.mode, "company-only");
  assert.equal(r.json.companyId, "acme", "scoped to the manager's session company, not the body");
  assert.ok(r.json.id && r.json.shareToken);
});

test("company-only: same-company member joins as 'verified'; other company refused; no session refused", async () => {
  const { json: room } = await postRoom("mgr-acme", { mode: "company-only" });

  const member = await connect(room.id, room.shareToken, "mem-acme");
  assert.ok(member.ws, "same-company member connects");
  assert.equal(member.state.identity, "verified");
  member.ws.close();

  const cross = await connect(room.id, room.shareToken, "globex");
  assert.equal(cross.refused, 403, "different company refused, no cross-company leak");

  const anon = await connect(room.id, room.shareToken, undefined);
  assert.equal(anon.refused, 401, "no session refused on a company-only room");
});

test("open-link room: token-gated join with no session connects as 'claimed'; wrong token refused", async () => {
  const { json: room } = await postRoom("mgr-acme", { mode: "open-link" });
  assert.equal(room.mode, "open-link");

  const guest = await connect(room.id, room.shareToken, undefined);
  assert.ok(guest.ws, "open-link guest connects without a session");
  assert.equal(guest.state.identity, "claimed");
  guest.ws.close();

  const bad = await connect(room.id, "wrong-token", undefined);
  assert.equal(bad.refused, 403);
});

test("provider seam: no env => stub; HUB_BASE_URL set => attempts the real adapter", async () => {
  const stub = await createAuthProvider({});
  assert.equal(stub.mode, "stub");
  assert.equal(typeof stub.verifySession, "function");

  // Configured but the package/hub are absent here (it is a deploy-time dep):
  // the real path must be ATTEMPTED, surfacing a clear hand-off error.
  await assert.rejects(
    () => createAuthProvider({ HUB_BASE_URL: "https://sprintsuite.uk", HUB_API_KEY: "k" }),
    /auth-client/,
  );
});
