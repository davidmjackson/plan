// @ts-check
/**
 * phase2-build5 server side: (1) collision-free participant colour carried in the
 * presence payload (R3), and (2) the ephemeral cursor relay — the HARD invariant
 * (R1): a cursor frame never touches room.doc/room.version, never persists, and is
 * fanned out to the OTHER sockets only (never echoed to the sender).
 *
 * Driven with real clients over a socket against an open-link room, the same way
 * mp5-presence drives presence.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";

import { openDb, loadRoom } from "../server/db.js";
import { startSpikeServer } from "../server/server.js";
import { createRoomStore } from "../public/js/sync-client.js";
import { PALETTE } from "../public/js/cursors.js";

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
  const ref = { presence: [], cursors: [] };
  ref.store = createRoomStore({
    transport: nodeWsTransport(`${server.url}/?room=demo&token=demo&name=${label}`),
    name: label,
    onPresence: (p) => { ref.presence = p; },
    onCursor: (c) => { ref.cursors.push(c); },
  });
  await until(() => ref.store.getState().settings.startDate === "2026-01-05");
  return ref;
}

// --- R3: server-assigned, collision-free colour in the presence payload -----

test("each participant gets a distinct palette colour, lowest-free; a leaver's colour is reused", async () => {
  const A = await connectStore("Ann");
  await until(() => A.presence.length === 1 && A.presence[0].colour);
  assert.equal(A.presence[0].colour, PALETTE[0], "first joiner gets palette index 0");

  const B = await connectStore("Bob");
  await until(() => A.presence.length === 2 && B.presence.length === 2);
  const byName = (list) => Object.fromEntries(list.map((p) => [p.name, p.colour]));
  const colours = byName(A.presence);
  assert.equal(colours.Ann, PALETTE[0]);
  assert.equal(colours.Bob, PALETTE[1], "second joiner gets the next free index");
  assert.notEqual(colours.Ann, colours.Bob);

  // Bob leaves -> his colour (index 1) frees. Carol takes the lowest free = 1.
  B.store.close();
  await until(() => A.presence.length === 1);
  const C = await connectStore("Carol");
  await until(() => A.presence.length === 2 && C.presence.length === 2);
  const after = byName(A.presence);
  assert.equal(after.Carol, PALETTE[1], "Carol reuses Bob's freed colour");

  A.store.close();
  C.store.close();
  await until(() => true);
});

// --- R1: the hard invariant — a cursor frame is pure ephemeral relay ---------

test("a cursor frame leaves room.version and room.doc untouched and writes nothing to the db", async () => {
  const A = await connectStore("Ann");
  const B = await connectStore("Bob");
  await until(() => A.presence.length === 2 && B.presence.length === 2);

  const before = loadRoom(db, "demo");
  const versionBefore = before.version;
  const docBefore = JSON.stringify(before.doc);

  // Ann sends a cursor position; the relay must not commit anything.
  A.store.sendCursor(0.25, 0.5);
  await until(() => B.cursors.some((c) => c.x === 0.25 && c.y === 0.5));

  const persisted = loadRoom(db, "demo");
  assert.equal(persisted.version, versionBefore, "room.version unchanged by a cursor frame");
  assert.equal(JSON.stringify(persisted.doc), docBefore, "room.doc byte-identical after a cursor frame");

  A.store.close();
  B.store.close();
  await until(() => true);
});

test("a cursor frame is fanned out to the OTHER sockets only, never echoed to the sender", async () => {
  const A = await connectStore("Ann");
  const B = await connectStore("Bob");
  await until(() => A.presence.length === 2 && B.presence.length === 2);

  A.cursors = []; B.cursors = [];
  A.store.sendCursor(0.1, 0.2);
  await until(() => B.cursors.length === 1);
  await wait(50); // give any (erroneous) self-echo time to arrive

  assert.equal(A.cursors.length, 0, "sender never receives its own cursor");
  assert.equal(B.cursors[0].x, 0.1);
  assert.equal(B.cursors[0].y, 0.2);
  assert.ok(B.cursors[0].id, "the relayed frame carries the sender's stable id");

  // clearCursor fans out a `gone` frame to the other socket only.
  B.cursors = [];
  A.store.clearCursor();
  await until(() => B.cursors.length === 1);
  assert.equal(B.cursors[0].gone, true);
  assert.ok(B.cursors[0].id);

  A.store.close();
  B.store.close();
  await until(() => true);
});

test("a malformed cursor frame (non-numeric coords) is dropped, not relayed", async () => {
  const B = await connectStore("Bob");
  await until(() => B.presence.length === 1);

  // A raw socket lets us push a junk frame the typed sendCursor would never emit,
  // without a test-only backdoor on the store.
  const raw = new WebSocket(`${server.url}/?room=demo&token=demo&name=Mallory`);
  await new Promise((r) => raw.on("open", r));
  await until(() => B.presence.length === 2);

  B.cursors = [];
  raw.send(JSON.stringify({ type: "cursor", x: "nope", y: null }));
  await wait(50);
  assert.equal(B.cursors.length, 0, "non-numeric coords are not fanned out");

  raw.close();
  B.store.close();
  await until(() => true);
});
