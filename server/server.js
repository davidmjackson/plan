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
import { fileURLToPath } from "node:url";
import { dirname, join as pathJoin } from "node:path";
import express from "express";
import { WebSocketServer } from "ws";

import { loadRoom, createRoom } from "./db.js";
import { applyOp } from "./rooms.js";
import { createAuthProvider } from "./auth.js";
import { createInitialState } from "../public/js/store.js";
import { validatePlan } from "../public/js/plan-io.js";
import { newId } from "../public/js/ids.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
 * Start the server. Holds its own room cache + room→sockets index, so each
 * instance (e.g. per test) is isolated.
 *
 * Slice MP1 additions over the spike: `serveStatic` mounts plan's public/ so a
 * browser can load the app AND open the ws from one origin in dev; `seedRoom`
 * creates an open-link dev room if absent (room-creation UI is a later slice).
 * @param {{
 *   db: import("better-sqlite3").Database,
 *   port?: number,
 *   serveStatic?: boolean,
 *   seedRoom?: { id: string, companyId: string, shareToken: string, mode: string } | null,
 *   auth?: any,
 * }} opts
 * @returns {Promise<{ url: string, httpUrl: string, close: () => void }>}
 */
export async function startSpikeServer({ db, port = 0, serveStatic = false, seedRoom = null, auth = null }) {
  const provider = auth ?? (await createAuthProvider(process.env));

  if (seedRoom && !loadRoom(db, seedRoom.id)) {
    createRoom(db, { ...seedRoom, doc: createInitialState("2026-01-05") });
  }

  // Always an express app: it carries the auth routes (real provider) and the
  // authed room-creation endpoint; static serving is opt-in. The ws upgrade is
  // handled separately on the http server, independent of express routing.
  const app = express();
  app.use(express.json());

  // Liveness (MP6 R5): unauthed, cheap — for systemd/monitoring.
  app.get("/health", (/** @type {any} */ _req, /** @type {any} */ res) => res.json({ ok: true }));

  provider.mountRoutes(app);

  // POST /rooms — authed room creation (MP2 R4). A company-only room is scoped to
  // the MANAGER's session company, never a client-supplied value. Open-link rooms
  // are also manager-created; only their JOIN policy differs.
  app.post("/rooms", provider.requireAuth, (/** @type {any} */ req, /** @type {any} */ res) => {
    const companyId = provider.companyOf(req);
    if (!companyId) return res.status(403).json({ error: "no company on session" });
    const mode = req.body?.mode === "open-link" ? "open-link" : "company-only";

    // Optional "import my plan into the room" (MP4 R1): validate with the existing
    // guard, seed the room doc with it, normalise the transient field. No plan =
    // an empty starting board.
    let doc;
    if (req.body?.plan != null) {
      const v = validatePlan(req.body.plan);
      if (!v.ok) return res.status(400).json({ error: v.reason });
      doc = { ...req.body.plan, lastReturnedStoryIds: [] };
    } else {
      doc = createInitialState("2026-01-05");
    }

    const id = `${companyId}-${newId("room")}`;
    const shareToken = newId("share");
    createRoom(db, { id, companyId, shareToken, mode, doc });
    res.json({ id, companyId, shareToken, mode });
  });

  if (serveStatic) app.use(express.static(pathJoin(__dirname, "..", "public")));

  const httpServer = createServer(app);
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
  // Presence (MP5): the room's current participants, server-derived from the
  // socket set, broadcast on join/leave. Per-connection; never plan state.
  const broadcastPresence = (id) => {
    const participants = [...(sockets.get(id) ?? [])].map((ws) => {
      const m = /** @type {any} */ (ws).meta;
      return { id: m.id, name: m.name, identity: m.identity };
    });
    broadcast(id, { type: "presence", participants });
  };

  httpServer.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const roomId = url.searchParams.get("room") ?? "";
    const token = url.searchParams.get("token");
    const name = url.searchParams.get("name") ?? "guest";
    const room = getRoom(roomId);
    const session = await provider.verifySession(req.headers);

    const decision = decideUpgrade(room, session, token);
    if (!decision.ok) {
      socket.write(`HTTP/1.1 ${decision.code} ${decision.msg}\r\n\r\n`);
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      /** @type {any} */ (ws).meta = { roomId, identity: decision.identity, name, session, id: newId("p") };
      join(roomId, ws);
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    const { roomId, identity } = /** @type {any} */ (ws).meta;
    const room = getRoom(roomId);
    // First frame: the authoritative state + this participant's identity tag.
    ws.send(JSON.stringify({ type: "state", doc: room.doc, version: room.version, identity }));
    broadcastPresence(roomId); // tell the room (incl. the new joiner) who's here

    ws.on("message", (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.type !== "op") return;

      const result = applyOp(db, room, { type: msg.op?.type, payload: msg.op?.payload });
      if (result.ok) {
        // Broadcast the EFFECTIVE op (the merged full-field payload for EDIT_STORY),
        // so every client reduces a complete payload (MP3 R4).
        broadcast(roomId, { type: "op", opId: msg.opId, op: result.op, version: result.version });
      } else {
        ws.send(JSON.stringify({ type: "nack", opId: msg.opId, reason: result.reason }));
      }
    });

    ws.on("close", () => { leave(roomId, ws); broadcastPresence(roomId); });
  });

  return new Promise((resolve) => {
    httpServer.listen(port, "127.0.0.1", () => {
      const addr = /** @type {import("node:net").AddressInfo} */ (httpServer.address());
      resolve({
        url: `ws://127.0.0.1:${addr.port}`,
        httpUrl: `http://127.0.0.1:${addr.port}`,
        close: () => { wss.close(); httpServer.close(); },
      });
    });
  });
}
