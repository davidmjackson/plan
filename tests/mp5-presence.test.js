// @ts-check
/**
 * Productionise slice 5 — presence. The server broadcasts the room's participant
 * list on join/leave; the real sync-client routes it to onPresence. Driven with
 * two real clients over a socket against an open-link room (guests are "claimed").
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";

import { openDb } from "../server/db.js";
import { startSpikeServer } from "../server/server.js";
import { createRoomStore } from "../public/js/sync-client.js";

let db, server;

before(async () => {
  db = openDb(":memory:");
  server = await startSpikeServer({
    db, port: 0,
    seedRoom: { id: "demo", companyId: "acme", shareToken: "demo", mode: "open-link" },
  });
});
after(() => { server.close(); db.close(); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, ms = 2000) {
  const t0 = Date.now();
  while (!pred()) { if (Date.now() - t0 > ms) throw new Error("timeout"); await wait(10); }
}

function nodeWsTransport(url) {
  const ws = new WebSocket(url);
  return {
    send: (m) => ws.send(JSON.stringify(m)),
    onMessage: (cb) => ws.on("message", (d) => cb(JSON.parse(d.toString()))),
    onOpen: (cb) => ws.on("open", cb),
    onClose: (cb) => ws.on("close", cb),
    close: () => ws.close(),
  };
}

async function connectStore(label) {
  const ref = { presence: [] };
  ref.store = createRoomStore({
    transport: nodeWsTransport(`${server.url}/?room=demo&token=demo&name=${label}`),
    name: label,
    onPresence: (p) => { ref.presence = p; },
  });
  await until(() => ref.store.getState().settings.startDate === "2026-01-05");
  return ref;
}

test("presence lists participants on join and updates on leave; open-link guests are 'claimed'", async () => {
  const A = await connectStore("Ann");
  await until(() => A.presence.length === 1);
  assert.equal(A.presence[0].name, "Ann");
  assert.equal(A.presence[0].identity, "claimed");
  assert.ok(A.presence[0].id, "participant has a stable id");

  const B = await connectStore("Bob");
  // Both clients see two participants.
  await until(() => A.presence.length === 2 && B.presence.length === 2);
  assert.deepEqual(A.presence.map((p) => p.name).sort(), ["Ann", "Bob"]);

  // B leaves → A's presence drops back to one.
  B.store.close();
  await until(() => A.presence.length === 1);
  assert.equal(A.presence[0].name, "Ann");

  A.store.close();
});
