// @ts-check
/**
 * Security hardening — the proxied rooms service sets suite-parity security
 * headers (CSP + HSTS + frame DENY ...) on every response and never leaks the
 * Express fingerprint via x-powered-by. Asserted against the REAL server over a
 * real HTTP fetch (same harness as mp6-deploy), and at the middleware unit level.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { openDb } from "../server/db.js";
import { startSpikeServer } from "../server/server.js";
import { makeSecurityHeaders, DEFAULT_CSP } from "../server/middleware/securityHeaders.js";

let db, server;
before(async () => { db = openDb(":memory:"); server = await startSpikeServer({ db, port: 0 }); });
after(() => { server.close(); db.close(); });

test("rooms responses carry CSP + HSTS and no x-powered-by", async () => {
  const res = await fetch(`${server.httpUrl}/health`);
  assert.equal(res.status, 200);

  const csp = res.headers.get("content-security-policy");
  assert.ok(csp, "Content-Security-Policy is set");
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src 'self' wss: ws:/);

  assert.equal(
    res.headers.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains",
  );
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    res.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(
    res.headers.get("permissions-policy"),
    "geolocation=(), camera=(), microphone=(), payment=()",
  );

  assert.equal(res.headers.get("x-powered-by"), null, "x-powered-by is disabled");
});

test("makeSecurityHeaders sets the suite-parity header set", () => {
  const set = {};
  const res = { setHeader: (k, v) => { set[k] = v; } };
  let nexted = false;
  makeSecurityHeaders()(/** @type {any} */ ({}), /** @type {any} */ (res), () => { nexted = true; });

  assert.equal(set["Content-Security-Policy"], DEFAULT_CSP);
  assert.match(DEFAULT_CSP, /connect-src 'self' wss: ws:/);
  assert.equal(set["Strict-Transport-Security"], "max-age=31536000; includeSubDomains");
  assert.equal(set["X-Frame-Options"], "DENY");
  assert.equal(set["X-Content-Type-Options"], "nosniff");
  assert.equal(set["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(set["Permissions-Policy"], "geolocation=(), camera=(), microphone=(), payment=()");
  assert.ok(nexted, "calls next()");
});
