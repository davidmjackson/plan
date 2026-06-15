// @ts-check
/**
 * Phase 2 spike — the standalone ws service. A thin Node process (its own port;
 * plan's static host is 3004) that:
 *   - authenticates the ws UPGRADE via the auth seam (verifySession),
 *   - enforces the per-room BLEND policy at the boundary (open-link vs
 *     company-only), company-scoped, with no cross-company leak,
 *   - holds ONE authoritative in-memory document per room (loaded once, mutated
 *     in place by the op loop),
 *   - runs every op through applyOp (reduce -> validatePlan -> commit BEFORE
 *     broadcast), broadcasting the applied op + version to the room and nacking
 *     a reject to its sender only.
 *
 * Borrows poker's shapes only: ws upgrade, the company-scoped room, shareToken.
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";

import { loadRoom } from "./db.js";
import { applyOp } from "./rooms.js";
import { verifySession } from "./auth-seam.js";

/**
 * Decide a ws upgrade against the room's blend policy (poker's decideUpgrade shape).
 * @returns {{ ok: true, identity: "verified" | "claimed" } | { ok: false, code: number, msg: string }}
 */
export function decideUpgrade(room, session, token) {
  if (!room) return { ok: false, code: 404, msg: "No Room" };

  if (room.mode === "company-only") {
    if (!session) return { ok: false, code: 401, msg: "No Session" };
    // Company scope: a valid session for a DIFFERENT company is a cross-company
    // attempt — refuse, never leak.
    if (session.company !== room.companyId) return { ok: false, code: 403, msg: "Wrong Company" };
    return { ok: true, identity: "verified" };
  }

  // open-link: link-possession is the gate; identity is self-asserted.
  if (token !== room.shareToken) return { ok: false, code: 403, msg: "Bad Token" };
  const identity = session && session.company === room.companyId ? "verified" : "claimed";
  return { ok: true, identity };
}

/**
 * Start the spike server. Holds its own room cache + room→sockets index, so each
 * instance (e.g. per test) is isolated.
 * @param {{ db: import("better-sqlite3").Database, port?: number }} opts
 * @returns {Promise<{ url: string, close: () => void }>}
 */
export function startSpikeServer({ db, port = 0 }) {
  const httpServer = createServer((_req, res) => { res.writeHead(426); res.end("Upgrade Required"); });
  const wss = new WebSocketServer({ noServer: true });

  /** @type {Map<string, any>} authoritative in-memory rooms */
  const rooms = new Map();
  /** @type {Map<string, Set<import("ws").WebSocket>>} room id -> sockets */
  const sockets = new Map();

  const getRoom = (id) => {
    if (!rooms.has(id)) {
      const r = loadRoom(db, id);
      if (r) rooms.set(id, r);
    }
    return rooms.get(id);
  };
  const join = (id, ws) => {
    if (!sockets.has(id)) sockets.set(id, new Set());
    sockets.get(id).add(ws);
  };
  const leave = (id, ws) => sockets.get(id)?.delete(ws);
  const broadcast = (id, msg) => {
    const json = JSON.stringify(msg);
    for (const ws of sockets.get(id) ?? []) ws.send(json);
  };

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const roomId = url.searchParams.get("room") ?? "";
    const token = url.searchParams.get("token");
    const name = url.searchParams.get("name") ?? "guest";
    const room = getRoom(roomId);
    const session = verifySession(req.headers);

    const decision = decideUpgrade(room, session, token);
    if (!decision.ok) {
      socket.write(`HTTP/1.1 ${decision.code} ${decision.msg}\r\n\r\n`);
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      /** @type {any} */ (ws).meta = { roomId, identity: decision.identity, name, session };
      join(roomId, ws);
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    const { roomId, identity } = /** @type {any} */ (ws).meta;
    const room = getRoom(roomId);
    // First frame: the authoritative state + this participant's identity tag.
    ws.send(JSON.stringify({ type: "state", doc: room.doc, version: room.version, identity }));

    ws.on("message", (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.type !== "op") return;

      const result = applyOp(db, room, { type: msg.op?.type, payload: msg.op?.payload, baseVersion: msg.baseVersion });
      if (result.ok) {
        broadcast(roomId, { type: "op", opId: msg.opId, op: msg.op, version: result.version });
      } else {
        ws.send(JSON.stringify({ type: "nack", opId: msg.opId, reason: result.reason }));
      }
    });

    ws.on("close", () => leave(roomId, ws));
  });

  return new Promise((resolve) => {
    httpServer.listen(port, "127.0.0.1", () => {
      const addr = /** @type {import("node:net").AddressInfo} */ (httpServer.address());
      resolve({
        url: `ws://127.0.0.1:${addr.port}`,
        close: () => { wss.close(); httpServer.close(); },
      });
    });
  });
}
