// @ts-check
/**
 * Production entrypoint for the multiplayer rooms service (MP6). systemd runs
 * this (see deploy/sprintplan-rooms.service). It only wires env + lifecycle —
 * the service behaviour is unchanged from startSpikeServer.
 *
 * Env (see docs/phase2-mp6-deploy-runbook.md):
 *   PORT          listen port on 127.0.0.1 (default 3014; apache proxies to it)
 *   ROOMS_DB      persistent better-sqlite3 file (NOT under public/); default /var/www/plan/data/rooms.db
 *   SERVE_STATIC  "1" to let node serve public/ too; default off (apache owns static)
 *   HUB_BASE_URL / HUB_API_KEY / APP_NAME / COOKIE_DOMAIN / APP_SESSIONS_DB
 *                 when HUB_BASE_URL is set, the real @suite/auth-client adapter is used (MP2);
 *                 otherwise the stub (no hub) — see server/auth.js.
 */

import { openDb } from "./db.js";
import { startSpikeServer } from "./server.js";

const PORT = Number(process.env.PORT) || 3014;
const ROOMS_DB = process.env.ROOMS_DB || "/var/www/plan/data/rooms.db";
const SERVE_STATIC = process.env.SERVE_STATIC === "1";

const db = openDb(ROOMS_DB);
const server = await startSpikeServer({ db, port: PORT, serveStatic: SERVE_STATIC });
console.log(`sprintplan rooms service listening on ${server.httpUrl} (db=${ROOMS_DB}, serveStatic=${SERVE_STATIC})`);

// Clean shutdown so systemd stop/restart releases the socket + db promptly.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`${sig} received — shutting down`);
    server.close();
    db.close();
    process.exit(0);
  });
}
