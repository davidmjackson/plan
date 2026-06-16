# Build state after phase2-build4 — handoff (collaboration polish; post-launch UAT backlog cleared)

**Purpose**: Ground the next session in what the code *actually is* after phase2-build4, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build. This snapshot supersedes `build-state-after-phase2-build3.md` (now in `docs/archive/`). **The MVP shipped (briefs 1–10), Phase 2 added live multiplayer rooms (spike → MP1–MP6 → live launch), then four post-launch builds cleared the entire UAT backlog: build1 (room-sync defect), build2 (connector arrowhead), build3 (demo/clear, capacity bar, return-to-backlog), and this build4 — the collaboration-polish cluster: name-on-join gate (#3), re-openable invite (#1), live-room name (#10), presence rail (#2).**

**As of**: phase2-build4 **shipped via PR #35** (merge commit `fac0266`). **`main` now at `fac0266`** (this build-state + the build4 sign-off ride one doc PR on top). `origin == local`. Tree: **199 unit/integration tests green** (`npm test`, drift gate first), `tsc --noEmit` clean, theme-drift `ok: /var/www/plan`. Director signed off after a full two-browser-room UAT.

**Companions**: sprintplan-mvp-spec.md, aide-rules-of-engagement.md, build-log.md, docs/README.md, phase2-build4.md, housekeeping-dragula-vendoring.md, demo-data.md, and `docs/archive/` (briefs 1–10, the phase2 MP1–6 + spike briefs/findings, and build-states after build1/build2/build3).

---

## What phase2-build4 shipped (this build)

Four room-mode chrome items, all additive and room-only (the local single-user app is byte-for-byte unchanged). PROPOSE rulings (David): P1 top-level await; P2 `dismissable` flag; P3 repurpose the Collaborate slot; P4 #10 option (a) no-new-data; ~~P5 read-only title~~ **reversed in UAT**; P6 rail inside `.workspace`; P7 one branch/PR.

- **#3 name-on-join gate**. A pure seam `resolveJoinName(rawNameParam)` → `{name, needsPrompt}` (`room-join.js`: ""/whitespace/null/"guest" all need the prompt; a real name trims and passes). In room mode, a **blocking, non-dismissable** prompt (`room-gate.js`, `promptForName`) runs via a **top-level `await` in `main.js` BEFORE the socket opens**; the chosen name is written into `roomParams` (so both the ws URL and the recorded name are correct) and `history.replaceState` keeps it on refresh. The creator (via "Open room") is gated the same way. `openModal` gained an opt-in `dismissable` flag (default `true`; the gate passes `false`).
- **#1 re-open the invite**. A pure `buildInviteUrl(origin, {room, token})` (`room-join.js`: room + optional token only; personal `name` never read, so it can't leak; URL-encoded). `collaborate.js` exports `openInviteModal` which reconstructs THIS room's link from its own params. The in-room Collaborate button slot is **repurposed to "Invite"** (local mode still opens the create dialog).
- **#10 live-room name (option a, no new schema/db)**. In room mode the board gets a header treatment: the band eyebrow reads "Live room", a **LIVE** indicator + participant count (kept in step by `renderPresence`), and the **plan title IS the room name** — now **editable and live-synced** (see the op-loop note below).
- **#2 presence rail**. `#presence` moved from the topbar into `.workspace` as a vertical **left rail** (`[rail | board | backlog]`), room mode only (`renderPresence` sets `hidden` when empty, so local mode reserves no space). Chips keep the verified/`(guest)` vocabulary; board/backlog drag is unaffected.

- **Files**: new `public/js/room-join.js`, `public/js/room-gate.js`; modified `public/js/main.js`, `public/js/collaborate.js`, `public/js/modal.js`, `public/index.html`, `public/css/plan.css`, `server/rooms.js`; tests `tests/room-join.test.js` (+7), `tests/spike-op-loop.test.js` (+1).

### The one deliberate op-loop change (headline shift)

UAT showed a read-only room name (P5) left the room **unnameable** in practice. The director ruled: reverse P5 and **add `SET_PLAN_TITLE` to the room op allow-list** so the room name (= plan title) is editable in a room and broadcasts live to every client. **This is the FIRST op-loop vocabulary change in the entire Phase 2 arc** — a conscious trade for a real editable/synced room name, not drift. Small and safe: the reducer already handled `SET_PLAN_TITLE`, `validatePlan` still guards the result, the broadcast path is unchanged; covered by a new `applyOp(SET_PLAN_TITLE)` round-trip test.

---

## Architecture as built (the contract a future brief extends)

Everything from briefs 1–10 and the Phase 2 arc still holds. **Reducer, actions, and schema remain UNCHANGED across all four post-launch builds; the ONE deliberate exception this build is a single op-loop allow-list entry (`SET_PLAN_TITLE`).**

- **State shape, actions, schema — UNCHANGED**: still `schemaVersion: 2`, `deps: [{ id, blockerId, blockedId }]`, **17 actions**, `validatePlan` the load-path spine. build4 added NO action (it reused the existing `SET_PLAN_TITLE` action) and NO schema/reducer change.
- **Room op allow-list (`server/rooms.js`)** is now **10 ops**: the 9 structural ops (ADD/EDIT/DELETE_EPIC, ADD/EDIT/DELETE_STORY, MOVE_STORY, LINK/UNLINK_DEP) **+ SET_PLAN_TITLE** (build4, for the live room name). `NEW_PLAN`/`LOAD_PLAN`/`SET_VELOCITY` etc. remain excluded (so #7 demo/clear stays local-only).
- **Room boot (`main.js`)** is now **async in room mode**: a top-level `await` resolves the #3 name gate before `createRoomStore`. The local path has no await and is byte-for-byte unchanged. `main.js` is an ES module (`type="module"`), so top-level await is valid.
- **Pure room-join seams (`room-join.js`)** — `resolveJoinName`, `buildInviteUrl`: DOM-free, unit-tested, consumed by the boot gate and the invite modal.
- **Board selectors (`board-selectors.js`)** — pure: `placedPoints`, `sprintPlacedPoints`, `planSummary`, `planCapacity`, `planBarData` (capacity bar tone = `pillState`, can't disagree with the pills).
- **Modal shell (`modal.js`)** — `openModal` takes an opt-in `dismissable` (default true; #3 gate passes false); also exports `confirmModal` (build3).
- **Presence** stays a server-derived side-channel (MP5 R2): never reduced into the plan doc, never through `applyOp`. `renderPresence` targets the `.workspace` rail and updates the `#room-live-count`.
- **Views react to store NOTIFICATIONS, not the return of dispatch** (the standing rule). Room store is pessimistic: a dispatch SENDS an op and the store mutates only when the server broadcasts it back.
- **The board/connector layer is a PURE VIEW** over `connectorsToDraw` + the violation flag (Brief 8 R1); arrowhead convention is **head-at-blocker** (phase2-build2). `storyCard()` renders both board and backlog; the `placed` flag (board-only) is the explicit signal.
- **Server (`server/`)**: `server.js` (express + ws upgrade + `POST /rooms`; `startSpikeServer` optional `host`, default `127.0.0.1`), `rooms.js` (serialized op loop + broadcast + the 10-op allow-list), `db.js`, `auth.js` (stub by default; real `@suite/auth-client` behind `HUB_BASE_URL`), `start.js` (systemd prod entrypoint, PORT 3014, `ROOMS_DB` default `/var/www/plan/data/rooms.db`), `dev-rooms.js` (local two-client UAT launcher; in-memory db; binds `0.0.0.0` for WSL→Windows).
- **Theme source of truth is the shared suite repo** (Brief 10): do NOT edit `instrument-core.css`, `oscilloscope.js`, or `glyphs.svg` — synced artifacts, drift gate goes red. `public/css/plan.css` is plan-local.
- **plan's local mode stays account-free and backend-free**; the room service is a SEPARATE process reached via the apache same-origin reverse proxy.

---

## Known limitations / carried forward

- **The post-launch UAT backlog (#1–#10) is now FULLY CLEARED** across build1–build4. There is **no queued cluster** — the next session is net-new direction (the director's call).
- **#7 demo/clear stays local-only**: `NEW_PLAN`/`LOAD_PLAN` are deliberately NOT room ops.
- **#3 gate is a UX guarantee, not a security boundary** (R4): open-link names stay self-asserted (that is what the `(guest)` marker is for); the gate is client-side. Server-side name enforcement is parked.
- **MP5 parking lot still parked**: live cursors / per-card "X is editing" / avatars beyond initials; cross-tab dedupe; presence heartbeats/idle.
- **Persisted/renamable named rooms (#10 option b)** not built — the room name is the plan title (option a). A separate room-name column would be the first server-DATA change if ever wanted.
- **Cycle detection still deferred**; **`@suite/auth-client` vendoring** open; **company-level entitlement** covers only the launcher's user; **sibling theme re-sync** open at suite level; **dragula vendoring** stays per-app; `extractPlan` upload mode is `"file"` in code.

---

## Commands

```
npm test               # npm run drift && node --test tests/*.test.js — 199 tests (drift gate first)
npm run drift          # theme-drift check against the shared suite source
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve the static app on http://localhost:3004 (local single-user)
npm run rooms          # PROD room service (server/start.js), PORT 3014; needs /var/www/plan/data/ (deploy artifact)
node server/dev-rooms.js   # LOCAL two-client UAT: static + ws on :3014 (binds 0.0.0.0), seeds an open-link "demo" room
```

Local two-client room UAT: run `node server/dev-rooms.js`, then open two browsers at
`http://localhost:3014/?room=demo&token=demo&name=Alice` and `…&name=Bob`. To exercise the #3 gate,
open `…/?room=demo&token=demo` **with no `&name=`** — the blocking prompt appears. Local mode = the
same URL with no `?room=` param. `npm run rooms` is PROD (expects `/var/www/plan/data/`); use
`dev-rooms.js` for UAT. **Restart the dev server after any `server/*.js` change — Node does not hot-reload.**

## Branch / merge model

`main` carries briefs 1–10, the Phase 2 spike + MP1–MP6 slices + launch follow-ups, phase2-build1
(PR #26), build2 (PR #27, `a2d132c`), the build2 doc PRs (#28–#30), build3 (PR #31, `f2be8dd`), the
dev-bind fix (#32, `cf2a800`), the build3 sign-off/SHA (#33, `abcb1b0`), the build3 build-state (#34,
`460de4a`), and **build4 (PR #35, `fac0266`)** — all merge commits (not squash/rebase) so the
build-log's per-build SHA references stay valid. Per-build feature branches off `main`. The rooms
service's suite-side pieces (hub registration, theme) live in `davidmjackson/suite`.

---

## Suggested next session

**No queued backlog** — the post-launch UAT cluster is fully shipped. The next session is the
director's net-new direction. Standing follow-ups that could seed it: `@suite/auth-client` vendoring
for clean redeploys; company-level entitlement beyond the launcher's user; the suite-level sibling
theme re-sync; or a fresh feature stream. RoE cadence applies: PROPOSE before building; feature
branch per build.
