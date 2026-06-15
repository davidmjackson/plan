// @ts-check
/**
 * Productionise slice 1 — end-to-end proof: the REAL client sync layer
 * (sync-client.js, the same module the browser loads) over a REAL socket against
 * the REAL server, two room stores in one open-link room. Only the transport
 * differs from the browser (node `ws` vs browser WebSocket; identical JSON
 * protocol), so this exercises the actual reducers + op loop + broadcast path.
 * The DOM render reacting to store notifications is the same render() every prior
 * brief ships and is verified visually in the browser.
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
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error("timeout waiting for condition");
    await wait(10);
  }
}

/** A node `ws` transport with the same shape as the browser wsTransport. */
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

/** Connect a room store and wait until the authoritative 'state' frame lands. */
async function connectStore(label) {
  const nacks = [];
  const store = createRoomStore({
    transport: nodeWsTransport(`${server.url}/?room=demo&token=demo&name=${label}`),
    name: label,
    onNack: (r) => nacks.push(r),
  });
  // Seeded room uses startDate 2026-01-05; the placeholder uses 2026-01-01.
  await until(() => store.getState().settings.startDate === "2026-01-05");
  return { store, nacks };
}

const addStory = (id) => ({ type: "ADD_STORY", payload: { id, title: id, summary: "", points: 3, epicId: null } });
const editStory = (id, title) => ({ type: "EDIT_STORY", payload: { id, title, summary: "", points: 3, epicId: null } });

test("two clients converge: ADD then MOVE then EDIT in A appears in B", async () => {
  const A = await connectStore("A");
  const B = await connectStore("B");

  A.store.dispatch(addStory("S1"));
  await until(() => "S1" in B.store.getState().stories);
  assert.ok("S1" in A.store.getState().stories, "A sees its own confirmed add");

  A.store.dispatch({ type: "MOVE_STORY", payload: { storyId: "S1", target: { kind: "sprint", index: 0 }, beforeId: null } });
  await until(() => B.store.getState().sprints[0].placedStoryIds.includes("S1"));

  A.store.dispatch(editStory("S1", "renamed"));
  await until(() => B.store.getState().stories.S1.title === "renamed");
  assert.equal(A.store.getState().stories.S1.title, "renamed");

  A.store.close(); B.store.close();
});

test("concurrent EDIT of DIFFERENT fields merges through the real client; no nack (MP3)", async () => {
  const A = await connectStore("A");
  const B = await connectStore("B");

  // seed a story and let both clients settle on the same version
  A.store.dispatch(addStory("S2")); // title "S2", points 3
  await until(() => "S2" in A.store.getState().stories && "S2" in B.store.getState().stories);

  // Dispatched back-to-back (no await between), so each client computes its delta
  // against the same pre-broadcast state: A changes only the title, B only points.
  A.store.dispatch(editStory("S2", "renamed")); // -> delta { id, title }
  B.store.dispatch({ type: "EDIT_STORY", payload: { id: "S2", title: "S2", summary: "", points: 7, epicId: null } }); // -> delta { id, points }

  await until(() =>
    A.store.getState().stories.S2.title === "renamed" && A.store.getState().stories.S2.points === 7 &&
    B.store.getState().stories.S2.title === "renamed" && B.store.getState().stories.S2.points === 7,
  );
  assert.equal(A.nacks.length + B.nacks.length, 0, "no nack — different fields merge");

  A.store.close(); B.store.close();
});
