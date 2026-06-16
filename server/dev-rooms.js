// @ts-check
/**
 * LOCAL DEV ONLY — a one-process two-client room for browser UAT (phase2-build1).
 * Serves the static app AND the rooms ws on port 3014, with a seeded open-link
 * "demo" room (room-creation UI needs the hub, which dev doesn't have). NOT a
 * production entrypoint — systemd uses server/start.js. In-memory db: fresh each
 * run. Open two browser tabs at:
 *   http://localhost:3014/?room=demo&token=demo&name=Alice
 *   http://localhost:3014/?room=demo&token=demo&name=Bob
 */

import { openDb } from "./db.js";
import { startSpikeServer } from "./server.js";

const db = openDb(":memory:");
const server = await startSpikeServer({
  db,
  port: 3014,
  serveStatic: true,
  // Bind all interfaces so a Windows browser can reach the WSL2 dev server
  // (a 127.0.0.1 bind is loopback-only and not forwarded across the WSL boundary).
  host: "0.0.0.0",
  seedRoom: { id: "demo", companyId: "acme", shareToken: "demo", mode: "open-link" },
});
console.log(`DEV rooms+static on ${server.httpUrl}`);
console.log(`  A: ${server.httpUrl}/?room=demo&token=demo&name=Alice`);
console.log(`  B: ${server.httpUrl}/?room=demo&token=demo&name=Bob`);

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => { server.close(); db.close(); process.exit(0); });
}
