BRIEF MP5: Productionise slice 5 — presence (who's in the room)

(Fifth productionise slice — the follow-on split out of MP4. One slice, RoE cadence, TDD, branch `feat-mp5-presence` off main. Deploy is now slice 6.)

Read first: server/server.js (the room→sockets index + the connection/close handlers this slice broadcasts from), public/js/sync-client.js (the frame router this slice extends with onPresence), public/js/main.js (the room-mode wiring + the topbar where the strip lives), docs/phase2-mp1-client-sync-brief.md (the room store contract).

GOAL
Show everyone in a room who else is here. The server already holds a per-room socket set and each socket's identity (verified member vs claimed guest); this slice broadcasts the participant list on join/leave and the client renders a small presence strip in room mode.

RULINGS (R1–R5)
- R1 PRESENCE IS PER-CONNECTION, SERVER-DERIVED. Each ws gets a stable participantId at upgrade; the server broadcasts `{ type:"presence", participants:[{ id, name, identity }] }` to the room on every join and leave. identity is "verified" (an authed company member) or "claimed" (an open-link guest with a self-asserted name) — the same distinction decideUpgrade already computes. Per-connection (two tabs = two entries); user-level dedupe is out of scope.
- R2 PRESENCE IS SIDE-CHANNEL, NOT PLAN STATE. The presence list is NOT reduced into the plan document and never touches validatePlan or persistence. createRoomStore exposes it via an `onPresence(participants)` callback (symmetric with onNack); the plan store/getState is unchanged.
- R3 THE CLAIMED/VERIFIED DISTINCTION IS VISIBLE. A guest (claimed) renders visibly distinct from a member (verified) — a guest marker — so a self-asserted name is never mistaken for a verified identity (the standing access ruling).
- R4 ROOM MODE ONLY, ADDITIVE UI. The strip shows only in a room; the local single-user app and the topbar are otherwise unchanged. Reuse the existing style vocabulary; no new design language.
- R5 NO SHIPPED-MODEL CHANGE. No reducer/actions/schema/validatePlan change; the op loop, MP1–MP4 behaviour, and the local path are untouched. Presence frames are not ops and never go through applyOp.

WHAT THIS SLICE BUILDS
1. server/server.js — mint a participantId per upgrade; a `broadcastPresence(roomId)` that sends the current participant list; call it after a connection joins and after a socket closes.
2. public/js/sync-client.js — route a "presence" frame to an `onPresence(participants)` callback (default no-op); ignore it for plan state (R2).
3. public/js/main.js + index.html + plan.css — a `#presence` strip, populated in room mode via onPresence (initials/name chips, a guest marker for claimed), hidden in local mode.

ASSERTED OUTCOMES (TDD)
- sync-client unit: a "presence" frame invokes onPresence with the participant list and does NOT change getState() or version (R2).
- integration (two real clients in one room): when B joins, both A and B receive a presence frame listing two participants with their identities; when B leaves, A receives a presence frame listing one. (open-link guest → identity "claimed".)
- server: a participant carries a stable id, its name (from the join), and identity verified/claimed.
- browser: a two-context room shows both names in the strip, the open-link guest marked as a guest; the strip is absent in local mode.
- regression: full suite + typecheck + drift green; MP1 path re-verified.

OUT OF SCOPE (parking lot)
- Live cursors / per-field editing indicators / "X is editing this card" (a later polish).
- User-level dedupe across tabs; presence heartbeats/idle/away states; avatars beyond initials.
- Reconnect/resume semantics.
- systemd deploy + hub registration + cross-origin wiring (slice 6).
- Any shipped reducer/actions/schema/validatePlan change.

DEFINITION OF DONE
- The server broadcasts presence on join/leave; sync-client routes it to onPresence (plan state untouched); the room shows a presence strip with the claimed/verified distinction.
- Asserted unit + integration outcomes green; full suite + typecheck + drift green; MP1 path re-verified; the strip verified in a two-browser room.
- No shipped-model change; local app unchanged.
- I can explain every line; build-log entry drafted (AI drafts, David signs off).

START BY (no code before the failing test): write the sync-client onPresence unit test + the two-client presence integration test (RED), implement the server broadcast + the client routing, then build the strip and verify in the browser.
