# Build state after phase2-build5 — handoff (live cursors + coloured avatars; first net-new direction)

**Purpose**: Ground the next session in what the code *actually is* after phase2-build5, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build. This snapshot supersedes `build-state-after-phase2-build4.md` (now in `docs/archive/`). **The MVP shipped (briefs 1–10), Phase 2 added live multiplayer rooms (spike → MP1–MP6 → live launch), then four post-launch builds cleared the entire UAT backlog (build1–build4). phase2-build5 is the FIRST net-new direction since: live cursors (the headline) + coloured participant avatars (the foundation), un-parking the MP5 "live cursors" item.**

**As of**: phase2-build5 **shipped via PR #37** (merge commit `MERGE_SHA`). **`main` now at `MERGE_SHA`.** `origin == local`. Tree: **217 unit/integration tests green** (`npm test`, drift gate first), `tsc --noEmit` clean, theme-drift `ok: /var/www/plan`. Director signed off ("All working") after a two-browser-room UAT including the independent-scroll check.

**Companions**: sprintplan-mvp-spec.md, aide-rules-of-engagement.md, build-log.md, docs/README.md, phase2-build5.md, housekeeping-dragula-vendoring.md, demo-data.md, and `docs/archive/` (briefs 1–10, the phase2 MP1–6 + spike briefs/findings, and build-states after build1–build4).

---

## What phase2-build5 shipped (this build)

Live cursors and coloured avatars in a shared room, **all additive and room-only** (the local single-user app is byte-for-byte unchanged). PROPOSE was ruled in chat (David accepted all recommendations, folded into R1–R5): P1 cursors-only, ownership stays verbal; P2 server-assigned colour; P3 board-only (backlog cursors parked); P4 content-box coordinates; P5 one branch/PR.

- **Coloured avatars (the foundation)**. The server assigns each connection a collision-free palette colour at upgrade (`pickColourIndex` over the room's in-use indices → lowest free, a leaver's colour reused), stored in `meta.colour` and carried in the presence payload (`{id, name, identity, colour}`). `renderPresence` tints the `.presence-initial` badge with it — for guests too, so two guests are told apart and badge colour matches cursor colour by construction (the `(guest)` label + chip tone still carry the guest distinction). White text reads on every palette hue; amber/red excluded (reserved for capacity).
- **Live cursors (the headline)**. Each participant sees the others' pointers move over the board in real time, each pointer + name label in that person's colour. A throttled (~30/s, trailing, last-position-always-sent) `pointermove` over the board sends normalised board fractions; `pointerleave` clears. A participant never sees their own cursor (server excludes the sender). Cursors land on the correct board cell even when two viewers have scrolled the (vertically) tall plan to different positions.

- **Files**: new `public/js/cursors.js` (the pure seams), `tests/cursors.test.js` (+14), `tests/phase2-build5-cursors.test.js` (+4, server colour + the R1 invariant); modified `server/server.js` (colour assignment + the ephemeral cursor relay), `public/js/sync-client.js` (`onCursor` + `sendCursor`/`clearCursor`), `public/js/main.js` (cursor overlay + pointermove + reconcile + badge tint), `public/index.html` (`#cursor-layer`), `public/css/plan.css` (overlay + pointer + label + coloured badge).

### The headline held — and one correction to the brief

**Sealed-model discipline fully restored.** Unlike build4 (which added `SET_PLAN_TITLE` to the allow-list), build5 makes **NO new action, NO schema/reducer change, and NO op-loop / allow-list change**. Cursors + colour are pure EPHEMERAL presence: client view/CSS/wiring plus ONE new ephemeral ws frame relayed by the server, never through `applyOp`, never touching `room.doc`/`room.version`, never committed (R1). This is the **first non-op data path through the server**, proven inert by a hard invariant test.

**Coordinate correction (review caught it before code).** The brief assumed a board that scrolls *horizontally* for a wide plan and said "the maths is identical whichever element scrolls." It isn't: neither `.board` nor `.workspace` has any `overflow` — sprints stack VERTICALLY and the **window** scrolls. So the overlay is a fixed viewport layer and the coordinate helpers use `getBoundingClientRect` **alone, with no `scrollLeft/scrollTop` term** — because the rect already moves with the page scroll, adding window scroll would double-count it (the exact bug the independent-scroll UAT targets). The round-trip property is preserved and unit-tested.

---

## Architecture as built (the contract a future brief extends)

Everything from briefs 1–10 and the Phase 2 arc still holds. **Reducer, actions, and schema remain UNCHANGED; the 10-op allow-list is UNCHANGED (build5 added nothing to it).**

- **State shape, actions, schema — UNCHANGED**: still `schemaVersion: 2`, `deps: [{ id, blockerId, blockedId }]`, **17 actions**, `validatePlan` the load-path spine.
- **Room op allow-list (`server/rooms.js`)** stays **10 ops** (the 9 structural ops + `SET_PLAN_TITLE` from build4). build5 touches it not at all — `rooms.js` is byte-for-byte unchanged. (Nit, untouched per R1: its doc-comment still reads "9 wire ops"; the `ALLOWED` set is actually 10 since build4.)
- **NEW — pure cursor/colour seams (`public/js/cursors.js`)**: `PALETTE` (8 saturated mid-dark hues, white-text-safe, amber/red excluded), `paletteColour(i)` (wraps mod length), `pickColourIndex(used, size)` (lowest free, wraps when full), `toBoardFraction(point, metrics)` / `fromBoardFraction(frac, metrics)` (exact inverses; metrics = `{left, top, width, height}` from `getBoundingClientRect` + content box, **no scroll term**), `reconcileCursors(drawn, present)` (ids to drop). DOM-free, unit-tested, **imported by BOTH server (colour) and client (cursors)** — consistent with server.js already importing `store.js`/`plan-io.js`/`ids.js`.
- **NEW — ephemeral cursor side-channel (R1, the hard invariant)**: a client sends `{type:"cursor", x, y}` / `{type:"cursor", gone:true}`; the server branch (BEFORE the non-op early-return) stamps the sender's `meta.id`, RECONSTRUCTS the frame (`{type:"cursor", id, x, y|gone}` — never the raw client object), drops non-finite coords, and fans out via `broadcastExcept` to the OTHER sockets only. Never `applyOp`, never `room.doc`/`room.version`, never commit. The sync-client routes a `cursor` frame to an `onCursor` callback (parallel to `onPresence`); `sendCursor`/`clearCursor` are room-store methods (transport stays encapsulated).
- **NEW — cursor overlay (R5, decoupled from the paint loop)**: `#cursor-layer` is a **fixed, full-viewport, `pointer-events:none`** layer that lives OUTSIDE `#board`, so `render()`'s `replaceChildren` never wipes it and it can never become a drop target or swallow a board click. `z-index: 40` sits below the modal backdrop (50), so cursors never bleed over an open card editor. The cursor handler updates it directly (outside the subscribe/paint loop); colour + name are looked up from the latest presence snapshot by id (so cursor frames stay tiny); a reconcile on every presence frame drops any cursor whose participant has left (covers disconnects, which fire no `gone`).
- **Presence** remains a server-derived side-channel (MP5 R2): never reduced into the plan doc, never through `applyOp`. `renderPresence` targets the `.workspace` rail, updates `#room-live-count`, and now feeds the cursor colour/name map.
- **Views react to store NOTIFICATIONS, not the return of dispatch**; the room store is pessimistic. The board/connector layer is a pure view; arrowhead convention is head-at-blocker (phase2-build2). `storyCard()` renders both board and backlog; the `placed` flag is the board-only signal.
- **Server (`server/`)**: `server.js` (express + ws upgrade + `POST /rooms`; `startSpikeServer` optional `host`, default `127.0.0.1`; now also assigns `meta.colour` and relays cursor frames), `rooms.js` (serialized op loop + the 10-op allow-list — unchanged), `db.js`, `auth.js`, `start.js` (PORT 3014), `dev-rooms.js` (local UAT launcher, binds `0.0.0.0`).
- **Theme source of truth is the shared suite repo** (Brief 10): do NOT edit `instrument-core.css`, `oscilloscope.js`, or `glyphs.svg`. `public/css/plan.css` is plan-local.
- **plan's local mode stays account-free and backend-free**; the room service is a SEPARATE process reached via the apache same-origin reverse proxy.

---

## Known limitations / carried forward

- **The MP5 parking lot is now PARTIALLY cleared**: live cursors + coloured avatars (beyond initials) shipped this build. **Still parked**: per-card "X is editing" indicators + drag ghosting; cursors inside the card-editor modal / any modal; **backlog cursors** (board-only this build, P3 — an easy follow-on); idle-timeout auto-hide; cursor smoothing/interpolation/animation; away/heartbeat; touch-cursor rendering (mouse/pen only); cross-tab dedupe.
- **Cursor colour is per-connection, not per-person**: two tabs from one person get two colours and two cursors (cross-tab dedupe stays parked).
- **Ownership stays VERBAL** (R4 / P1): no owner field, action, or schema change. A persisted sprint/story owner would be a schema bump + a new op + an allow-list entry — a separate brief if ever wanted (would be the first server-DATA change of this arc).
- **The post-launch UAT backlog (#1–#10) remains fully cleared**; there is no queued cluster.
- **Persisted/renamable named rooms (#10 option b)** not built. **Cycle detection still deferred**; **`@suite/auth-client` vendoring** open; **company-level entitlement** covers only the launcher's user; **sibling theme re-sync** open at suite level; **dragula vendoring** stays per-app; `extractPlan` upload mode is `"file"` in code.

---

## Commands

```
npm test               # npm run drift && node --test tests/*.test.js — 217 tests (drift gate first)
npm run drift          # theme-drift check against the shared suite source
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve the static app on http://localhost:3004 (local single-user)
npm run rooms          # PROD room service (server/start.js), PORT 3014; needs /var/www/plan/data/ (deploy artifact)
node server/dev-rooms.js   # LOCAL two-client UAT: static + ws on :3014 (binds 0.0.0.0), seeds an open-link "demo" room
```

Local cursor UAT: run `node server/dev-rooms.js`, then open two browsers at
`http://localhost:3014/?room=demo&token=demo&name=Alice` and `…&name=Bob`. Move Alice's mouse over
the board and watch a coloured pointer labelled "Alice" track over the same cell in Bob's window
(and vice versa); the cursor colour matches that person's avatar badge. Scroll the two windows to
different sprints to exercise the content-box normalisation. Local mode = the same URL with no
`?room=` param (no cursor layer, no colour). **Restart the dev server after any `server/*.js` change
— Node does not hot-reload** (some server test runs may need `--test-force-exit` because the ws
sockets keep the loop alive).

## Branch / merge model

`main` carries briefs 1–10, the Phase 2 spike + MP1–MP6 + launch follow-ups, phase2-build1 (PR #26),
build2 (PR #27 `a2d132c`; doc PRs #28–#30), build3 (PR #31 `f2be8dd`; dev-bind fix #32 `cf2a800`;
sign-off #33 `abcb1b0`; build-state #34 `460de4a`), build4 (PR #35 `fac0266`; sign-off/build-state
#36 `987aa00`), and **build5 (PR #37, `MERGE_SHA`)** — all merge commits (not squash/rebase) so the
build-log's per-build SHA references stay valid. Per-build feature branches off `main`. The rooms
service's suite-side pieces live in `davidmjackson/suite`.

---

## Suggested next session

**No queued backlog.** The next session is the director's net-new direction. Natural follow-ons that
this build opens: **backlog cursors** (P3 parked, easy), per-card "editing" indicators / drag
ghosting (MP5 parking lot), or cross-tab dedupe. Standing follow-ups that could seed a different
stream: `@suite/auth-client` vendoring for clean redeploys; company-level entitlement beyond the
launcher's user; the suite-level sibling theme re-sync; persisted/renamable named rooms (#10 option
b, the first server-DATA change). RoE cadence applies: PROPOSE before building; feature branch per
build.
