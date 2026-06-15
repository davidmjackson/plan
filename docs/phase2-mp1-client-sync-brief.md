BRIEF MP1: Productionise slice 1 — the client sync layer + open-link rooms (real client over the proven op loop)

(First productionise slice after the spike PASS. The spike proved the SERVER op loop with a thin shim; this slice proves plan's REAL client store survives being round-tripped through it. One slice, RoE cadence: this brief is the spec; build is TDD on `feat-mp1-client-sync`.)

Read first: docs/phase2-multiplayer-spike-finding.md (the GO verdict; the one net-new rule = the EDIT_STORY version-gate; the global-version false-conflict tradeoff DEFERRED to slice 3), docs/phase2-multiplayer-spike-build-brief.md + the spike code under `server/` (formerly `spike/`: db.js, rooms.js, server.js, auth-seam.js — the proven op loop this slice keeps verbatim), public/js/main.js (the bootstrap this slice branches: store creation at :117, autosave at :123, the resume-prompt gate at :368), public/js/store.js (createStore/reduce — the dispatch/subscribe interface the room store must mirror).

DIRECTOR RULINGS THIS SLICE INHERITS (decided this session; not reopened here)
- PRODUCT MODEL = free, accounts, charge-later seam unused.
- DEPLOY = standalone systemd service on the live box (slice 5 owns the packaging; this slice runs it locally).
- COEXISTENCE = DUAL-MODE. The static single-user app is UNTOUCHED. Room mode is a parallel, opt-in path. No existing localStorage plan is read or written in room mode. "Import local plan into a room" is a later slice (4).

GOAL
Wire plan's existing client store to the proven server op loop so two browsers edit one board live, in an OPEN-LINK room. Prove the real client (its dispatch, its reducers, its render) behaves correctly when the server is authoritative — the single biggest unproven integration risk after the spike.

THE MODEL = SERVER-AUTHORITATIVE, PESSIMISTIC CLIENT (the load-bearing decision of this slice)
The client does NOT apply its own edits locally. On a local dispatch it sends an OP and waits; it mutates its store ONLY when the server broadcasts the applied op back. This is deliberately the simplest correct model: no optimistic-apply-then-rollback, so no client-side divergence or revert bugs. Round-trip latency on LAN is negligible. (Optimistic local echo is a later UX refinement, parked — slice 4.)

RULINGS (R1–R6, do not silently change)
- R1 PESSIMISTIC. dispatch(action) in room mode = send {opId, op:{type,payload}, baseVersion} over ws; it does NOT reduce locally. The store changes only on a server broadcast.
- R2 THE ROOM STORE MIRRORS THE LOCAL STORE INTERFACE. createRoomStore returns { getState, dispatch, subscribe } byte-compatible with createStore, so EVERY view module (render, drag, card-editor, etc.) is reused UNCHANGED. The view cannot tell which store it holds.
- R3 DUAL-MODE IS A CLEAN FORK AT BOOT. main.js reads the room params; if present it takes the room path (no autosave, no resume prompt, no localStorage read/write); else the existing local path runs exactly as today. No existing sprintplan:board data is touched in room mode (the coexistence ruling).
- R4 REUSE THE SERVER VERBATIM. The op loop (applyOp → reduce → validatePlan → commit → broadcast) and the global-version model are unchanged from the spike. This slice adds only: static-file serving (so a browser can load the app + ws from one origin in dev) and a seeded dev room. Per-entity rev and EDIT_STORY field-delta stay slice 3.
- R5 OPEN-LINK ONLY. Rooms this slice are open-link (shareToken + a claimed name); no @suite/auth-client wiring (slice 2). The auth seam stays as-is; the upgrade for an open-link room needs only the right token.
- R6 A NACK IS VISIBLE, NEVER SILENT. A nack (validatePlan reject, or a stale EDIT_STORY) surfaces to the user via the existing toast (flash) and leaves the authoritative state as the server has it. Excluded ops in room mode (settings SET_*, NEW_PLAN, LOAD_PLAN — see the spike op vocabulary) are nacked and toasted "not available in a shared room" for now; disabling those controls in room mode is slice 4 polish.

WHAT THIS SLICE BUILDS
1. Promote `spike/` → `server/` (git mv; update the two spike test imports). The proof tests keep passing as regression. Add to the server: express.static over `public/` (dev convenience — one origin for app + ws) and a `seedRoom` option that creates an open-link room if absent.
2. `public/js/sync-client.js` — `createRoomStore({ transport, name })`:
   - holds an in-memory PlanState + version (seeded from a minimal valid empty plan until the server's authoritative state arrives),
   - on a 'state' frame: set doc + version, notify subscribers,
   - dispatch(action): mint an opId, send the op with baseVersion = current version; do NOT reduce locally (R1),
   - on an 'op' broadcast: reduce(doc, op), adopt the broadcast version, notify,
   - on a 'nack' frame: invoke an onNack(reason) hook (no state change),
   - transport is INJECTED ({ send, onMessage, onOpen, onClose }) so the logic is unit-testable without a real socket; a `wsTransport(url)` wraps the browser WebSocket.
3. `public/js/main.js` — a room-mode branch at boot: read `?room=&token=&name=`; if present, build the room store via `wsTransport` (ws URL derived from window.location, so it works under the node dev server now and a configured service later), wire onNack→flash, render on its notifications, and SKIP autosave + the resume-prompt/classifySave gate (R3). Absent the param, today's local path is byte-for-byte unchanged.

ASSERTED OUTCOMES (the slice's DoD proof)
Unit (node --test, injected fake transport):
- a local dispatch sends exactly one op carrying the action and the current baseVersion; local state is UNCHANGED until a broadcast (R1).
- a 'state' frame sets the doc + version and notifies.
- an 'op' broadcast reduces the doc, adopts the version, and notifies.
- a 'nack' frame calls onNack and changes neither doc nor version.
- the room store's getState/dispatch/subscribe shape matches createStore (R2).
Browser (two contexts, real server, real client — Playwright; there is a UI now, unlike the spike):
- two browsers in one open-link room: an ADD_STORY / MOVE_STORY / EDIT_STORY in browser A appears in browser B (server-confirmed), and the boards converge.
- a concurrent same-story EDIT in both browsers: one wins, the other sees the toast and the winner's value (R6, the spike's case 5 now through the real UI).
- with NO ?room param, the app is exactly today's local app (autosave + resume prompt intact); room mode never writes sprintplan:board (R3).

OUT OF SCOPE (parking lot — do NOT pull these in)
- @suite/auth-client wiring, company-only rooms, the entitlement seam (slice 2).
- Per-entity rev, EDIT_STORY field-delta (slice 3) — the global-version model stands this slice.
- Room creation/management UI, the blend-mode picker, the share-link UI, "import local plan into room", presence/cursors (slice 4). This slice uses a seeded dev room.
- systemd packaging, DB backups, the native-dep CI, the live release (slice 5).
- Optimistic local echo / reconnection-resync (parked UX; pessimistic + a simple disconnect notice this slice).
- Any change to plan's shipped reducers/actions/schema/validatePlan, or to the local-mode path.

DEFINITION OF DONE
- `server/` promoted, the spike proof tests still green; the server serves static + seeds an open-link dev room.
- `sync-client.js` built TDD (failing unit tests first), all unit assertions above green.
- main.js room-mode branch wired; local mode provably unchanged.
- Two-browser live-sync verified (the asserted browser outcomes), zero console errors, and the sprintplan:board key proven untouched in room mode.
- Full suite + typecheck + drift green.
- I can explain every line; build-log entry drafted (AI drafts, David signs off).

START BY (no client code before the failing test): write the createRoomStore unit tests against an injected fake transport, watch them fail, then implement sync-client.js. Promote the server, then wire main.js, then the browser proof.
