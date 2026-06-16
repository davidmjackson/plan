// @ts-check
/**
 * phase2-build1 REPRODUCE + sync-layer lock — two REAL room stores over a REAL
 * socket against the REAL server (same harness as mp1-integration). This proves
 * the dependency defect is NOT in the sync layer:
 *
 *   1. The room store is PESSIMISTIC: immediately after dispatch(linkDep) the
 *      dispatching client's own state does NOT yet contain the dep. This is the
 *      exact condition that breaks the card editor — buildDependencies calls
 *      renderRows() synchronously after dispatch and reads this stale state, so
 *      the row never appears (the modal symptom).
 *   2. The op round-trips: once the server echoes, BOTH clients reduce the dep,
 *      with NO nack — clearing the brief's "verify, don't assume" second-order
 *      concern (no validatePlan reject, no allow-list block). LINK_DEP/UNLINK_DEP
 *      are sound on the wire; the fix is view-layer only.
 *
 * The modal/board DOM reacting to store notifications is verified visually in the
 * browser (two-client UAT), as with every prior view brief.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";

import { openDb } from "../server/db.js";
import { startSpikeServer } from "../server/server.js";
import { createRoomStore } from "../public/js/sync-client.js";
import { addStory, linkDep, unlinkDep } from "../public/js/actions.js";

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
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error("timeout waiting for condition");
    await wait(10);
  }
}

function nodeWsTransport(url) {
  const ws = new WebSocket(url);
  return {
    send: (msg) => ws.send(JSON.stringify(msg)),
    onMessage: (cb) => ws.on("message", (d) => cb(JSON.parse(d.toString()))),
    onOpen: (cb) => ws.on("open", cb),
    onClose: (cb) => ws.on("close", cb),
    close: () => ws.close(),
  };
}

async function connectStore(label) {
  const nacks = [];
  const store = createRoomStore({
    transport: nodeWsTransport(`${server.url}/?room=demo&token=demo&name=${label}`),
    name: label,
    onNack: (r) => nacks.push(r),
  });
  await until(() => store.getState().settings.startDate === "2026-01-05");
  return { store, nacks };
}

const hasDep = (s, id) => s.getState().deps.some((d) => d.id === id);

test("LINK_DEP is pessimistic locally then round-trips to both clients, no nack", async () => {
  const A = await connectStore("A");
  const B = await connectStore("B");

  // Two stories both clients agree on (capture the minted ids from the actions).
  const add1 = addStory({ title: "S1", summary: "", points: 3, epicId: null });
  const add2 = addStory({ title: "S2", summary: "", points: 3, epicId: null });
  A.store.dispatch(add1);
  A.store.dispatch(add2);
  await until(() => Object.keys(B.store.getState().stories).length === 2);

  // (1) ROOT CAUSE: dispatch sends the op and does NOT mutate local state.
  const link = linkDep({ blockerId: add1.payload.id, blockedId: add2.payload.id });
  A.store.dispatch(link);
  assert.equal(
    hasDep(A.store, link.payload.id), false,
    "pessimistic: A's own state has no dep synchronously after dispatch — this is what makes renderRows()-after-dispatch read stale and show nothing",
  );

  // (2) ROUND-TRIP: the server echo reduces the dep on BOTH clients, no nack.
  await until(() => hasDep(A.store, link.payload.id) && hasDep(B.store, link.payload.id));
  assert.equal(A.nacks.length + B.nacks.length, 0, "LINK_DEP is allow-listed and passes validatePlan — no nack");

  // (3) UNLINK round-trips and removes on both clients.
  A.store.dispatch(unlinkDep({ id: link.payload.id }));
  await until(() => !hasDep(A.store, link.payload.id) && !hasDep(B.store, link.payload.id));
  assert.equal(A.nacks.length + B.nacks.length, 0, "UNLINK_DEP round-trips cleanly too");

  A.store.close(); B.store.close();
});
