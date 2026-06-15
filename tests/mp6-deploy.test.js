// @ts-check
/**
 * Productionise slice 6 — deploy. A liveness route for systemd/monitoring:
 * unauthed, cheap, always 200 when the service is up.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { openDb } from "../server/db.js";
import { startSpikeServer } from "../server/server.js";

let db, server;
before(async () => { db = openDb(":memory:"); server = await startSpikeServer({ db, port: 0 }); });
after(() => { server.close(); db.close(); });

test("GET /health is 200 { ok: true } with no auth", async () => {
  const res = await fetch(`${server.httpUrl}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});
