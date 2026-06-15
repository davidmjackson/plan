// @ts-check
/**
 * Productionise slice 1 — the room store (client sync layer).
 *
 * createRoomStore returns the SAME { getState, dispatch, subscribe } shape as
 * createStore, so every view module reuses it unchanged (R2). The model is
 * server-authoritative and PESSIMISTIC (R1): a local dispatch SENDS an op and
 * waits; the store mutates only when the server broadcasts the applied op back.
 * That removes optimistic-apply-then-rollback entirely — there is no client-side
 * divergence to reconcile.
 *
 * The transport is injected so the sync logic is unit-testable without a socket;
 * wsTransport wraps the browser WebSocket for the real app.
 *
 * @typedef {{
 *   send: (msg: any) => void,
 *   onMessage: (cb: (msg: any) => void) => void,
 *   onOpen: (cb: () => void) => void,
 *   onClose: (cb: () => void) => void,
 *   close: () => void,
 * }} Transport
 */

import { reduce, createInitialState } from "./store.js";
import { newId } from "./ids.js";

/**
 * @param {{ transport: Transport, name?: string, onNack?: (reason: string) => void }} opts
 * @returns {{ getState: () => any, dispatch: (action: { type: string, payload?: any }) => void, subscribe: (fn: (s: any) => void) => () => void, close: () => void }}
 */
export function createRoomStore({ transport, name = "guest", onNack = () => {} }) {
  // Placeholder until the server's authoritative 'state' frame arrives.
  let state = createInitialState("2026-01-01");
  let version = 0;
  /** @type {Set<(s: any) => void>} */
  const subscribers = new Set();
  const notify = () => { for (const fn of subscribers) fn(state); };

  transport.onMessage((msg) => {
    if (msg.type === "state") {
      state = msg.doc;
      version = msg.version;
      notify();
    } else if (msg.type === "op") {
      // Authoritative: apply exactly what the server confirmed, in its order.
      state = reduce(state, msg.op);
      version = msg.version;
      notify();
    } else if (msg.type === "nack") {
      onNack(msg.reason);
    }
  });

  return {
    getState: () => state,
    dispatch(action) {
      // Pessimistic: emit the op, do NOT reduce locally (R1).
      transport.send({
        type: "op",
        opId: newId("op"),
        op: { type: action.type, payload: action.payload },
        baseVersion: version,
      });
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    /** Tear down the connection (navigation / leaving a room). */
    close() {
      transport.close();
    },
  };
}

/**
 * Browser WebSocket transport. Browser-only glue (verified in the real app, not
 * the unit net). Frames are JSON {type, ...}.
 * @param {string} url
 * @returns {Transport}
 */
export function wsTransport(url) {
  const ws = new WebSocket(url);
  return {
    send: (msg) => ws.send(JSON.stringify(msg)),
    onMessage: (cb) => ws.addEventListener("message", (e) => cb(JSON.parse(/** @type {MessageEvent} */ (e).data))),
    onOpen: (cb) => ws.addEventListener("open", cb),
    onClose: (cb) => ws.addEventListener("close", cb),
    close: () => ws.close(),
  };
}
