# Build state after phase2-build3 — handoff (three standalone post-launch slices shipped)

**Purpose**: Ground the next session in what the code *actually is* after phase2-build3, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build. This snapshot supersedes `build-state-after-phase2-build2.md` (now in `docs/archive/`). **The MVP shipped (briefs 1–10), Phase 2 added live multiplayer rooms (spike → MP1–MP6 → live launch), phase2-build1 fixed the dependency room-sync defect, phase2-build2 fixed the connector arrowhead, and this build shipped the three standalone post-launch UAT slices: one-click demo/clear (#7), a plan-capacity bar (#8), and one-click return-to-backlog (#9).**

**As of**: phase2-build3 **shipped via PR #31** (merge commit `f2be8dd`, feature work `1cd918f` + the always-visible-control tweak `45bfbf8`). Companion PRs the same session: **PR #32** (`cf2a800`) the dev WSL bind fix (dev-tooling only); **PR #33** (`abcb1b0`) the build3 director sign-off + the prior build-state's SHA bump. **`main` now at `abcb1b0`**, `origin == local`. Tree: **191 unit/integration tests green** (`npm test`, which runs the theme-drift gate *first*), `tsc --noEmit` clean, theme-drift `ok: /var/www/plan`. Director signed off after a full browser UAT (local 3a/3b/3c + a two-client room for 3c).

**Companions**: sprintplan-mvp-spec.md, aide-rules-of-engagement.md, build-log.md, docs/README.md, phase2-build3.md, housekeeping-dragula-vendoring.md, demo-data.md, and `docs/archive/` (briefs 1–10, their build-states, the phase2 MP1–6 + spike briefs/findings, build-state-after-phase2-build1.md, and build-state-after-phase2-build2.md).

---

## What phase2-build3 shipped (this build)

Three independent, additive slices from the post-launch UAT backlog. The headline, held end to end: **all three ship with NO new action, NO schema change, NO reducer change, and NO server/op-loop change** — the Phase 2 sealed-model discipline (R2) runs straight through a third build. PROPOSE rulings (David, all recommended): one branch/PR for the three; 3a confirm via the existing `modal.js`; 3b bar carries a muted backlog annotation; 3c the on-card control (Option A).

- **#7 one-click demo + clear (LOCAL MODE ONLY)**. Two top-bar `.tbacts` buttons (`tb-demo`, `tb-clear`). Demo *fetches* the bundled `public/samples/sample-plan.json` and runs it through the SAME import boundary as file-import — a new shared `loadParsedPlan(parsed, mode, failPrefix)` helper in `main.js` (`extractPlan` → `migratePlan` → `validatePlan` → `loadPlan`), so import behaviour is byte-for-byte unchanged. Clear reuses the resume-prompt path (`newPlan(nextMonday(todayISO()))`). Each REPLACES the whole plan, so when the board is non-empty it confirms first (a new reusable `confirmModal()` in `modal.js`); an empty board (no epics, no stories) skips the confirm. Both re-arm the per-sprint banners (`clearDismissedBanners`) before dispatch. **Both controls hide in a room** (`IN_ROOM`) exactly like Collaborate — `NEW_PLAN`/`LOAD_PLAN` are NOT room ops, so they are never dispatched there.
- **#8 plan-capacity bar**. A slim band (`#plan-bar`) between the settings strip and `.workspace`. Two new PURE selectors in `board-selectors.js`: `planCapacity(state)` (sum of `sprintCapacity` over sprints — already prorates the partial final sprint, so a plain sum is correct) and `planBarData(state)` → `{ planned, capacity, backlogPoints, tone }`. `planned` reuses `planSummary().placedPoints` (the points authority); `tone` is `pillState(planned, capacity)` — the SAME tested function the sprint pills use, so **the bar can never disagree with the pills**. `renderPlanBar(state)` (called from `render()`) draws the fill proportion + a mono `placed / capacity pts` figure + a muted `N in backlog` annotation. Dispatches nothing.
- **#9 return a placed story to the backlog**. View wiring only — the move is the existing `MOVE_STORY` with `target {kind:"backlog"}`, `beforeId null` (append to backlog end), which already conserves the id and already broadcasts in a room (`MOVE_STORY` is allow-listed). `storyCard()` gains an explicit `placed` flag (board cards only — default `false`, so backlog calls are unchanged; epic-presence is NOT a board-vs-backlog signal). The on-card control carries `data-act="return-to-backlog"`; the `#board` delegated listener routes it to `MOVE_STORY` (no toast — a manual return leaves `lastReturnedStoryIds` empty). `drag.js` `moves` excludes the control as a drag handle (`handle.closest('[data-act="return-to-backlog"]')`) so grabbing it never starts a drag, and the existing `isDragging()` guard stops the trailing click opening the editor. The control is **always visible** on placed cards (David's call; plum on hover, the interaction accent).

- **Files**: `public/index.html`, `public/css/plan.css` (all new CSS, reusing the pill's amber/red wash tokens; plum stays the interaction accent), `public/js/board-selectors.js`, `public/js/render.js`, `public/js/backlog.js`, `public/js/drag.js`, `public/js/main.js`, `public/js/modal.js`, plus `tests/board-selectors.test.js` (+5) and `tests/plan-io.test.js` (+1).
- **Tests**: +6. `planCapacity` (full sprints, prorated partial, generated-plan), the `planBarData` neutral/amber/red boundary invariant (`tone === pillState(planned, capacity)`), the backlog annotation, and a `sample-plan.json` load-boundary tripwire (guards the #7 demo path if the schema bumps). `MOVE_STORY`→backlog conservation + no-toast was already covered (`store-move.test.js` Case 4), so #9 needed no new unit test.

---

## Architecture as built (the contract a future brief extends)

Everything from briefs 1–10 and the Phase 2 arc still holds. **The entire Phase 2 arc + all three post-launch builds added NO action, NO schema change, NO reducer change, NO server op-loop change to the shipped model (R2 throughout).**

- **State shape, actions, schema — UNCHANGED**: still `schemaVersion: 2`, `deps: [{ id, blockerId, blockedId }]`, **17 actions**, `validatePlan` the load-path spine. build3 reused `MOVE_STORY`/`newPlan`/`loadPlan`; it added none.
- **Board selectors (`board-selectors.js`)** — pure, DOM-free: `placedPoints`, `sprintPlacedPoints`, `planSummary`, and (build3) `planCapacity` + `planBarData`. The pill and the new capacity bar both derive their over/under state from `pillState`, so they cannot disagree.
- **Dual-mode boot (`main.js`)**: a `?room=` URL param forks to a server-authoritative room store over a WebSocket; absent the param the local single-user app is byte-for-byte unchanged (localStorage autosave + the Brief 6 resume prompt). The store interface (`{getState, dispatch, subscribe}`) is the seam, so every view module is reused unchanged across both stores. **Local-only controls** (demo/clear, like Collaborate) hide when `IN_ROOM`.
- **Views react to store NOTIFICATIONS, not to the return of dispatch** (the phase2-build1 standing rule). Subscriptions a modal adds MUST be torn down on close (the `modal.js` `onClose` hook). `modal.js` now also exports a reusable `confirmModal({heading, message, confirmLabel, danger, onConfirm})`.
- **The board/connector layer is a PURE VIEW over `connectorsToDraw` + the carried violation flag** (Brief 8 R1). The arrowhead convention is **head-at-blocker** (depended-on), set in phase2-build2 — consciously reversing Brief 8's documented dependent-end convention. The single shared `#dep-arrow` marker uses `fill: context-stroke` so it follows neutral/violation stroke. The overlay is recreated on every `renderBoard`.
- **The shared `storyCard()` renders BOTH board and backlog**; the `placed` flag (board-only) is the explicit board-vs-backlog signal — epic-presence is not reliable (a No-epic placed card has `epic=null` too).
- **Server (`server/`)**: `server.js` (express + ws upgrade + `POST /rooms`; `startSpikeServer` now takes an optional `host`, **default `127.0.0.1`** so prod is unchanged), `rooms.js` (serialized op loop + broadcast + 9-op allow-list incl. LINK/UNLINK_DEP; `NEW_PLAN`/`LOAD_PLAN` are NOT in it — the reason #7 is local-only), `db.js` (better-sqlite3), `auth.js` (stub by default; real `@suite/auth-client` via dynamic import behind `HUB_BASE_URL`), `start.js` (systemd prod entrypoint, PORT 3014, `ROOMS_DB` default `/var/www/plan/data/rooms.db`), `dev-rooms.js` (local two-client UAT launcher; in-memory db; **binds `0.0.0.0`** so a Windows browser reaches the WSL2 dev server).
- **Theme source of truth is the shared suite repo** (Brief 10): do NOT edit `public/css/instrument-core.css`, `public/js/oscilloscope.js`, or `public/illos/glyphs.svg` here — synced artifacts, the drift gate goes red. `public/css/plan.css` is plan-local (all build3 CSS landed there).
- **plan's local mode stays account-free and backend-free**; the room service is a SEPARATE process (systemd `sprintplan-rooms`) reached via the apache same-origin reverse proxy.

---

## Known limitations / carried forward

- **The UAT backlog (from the post-launch UAT session) is now cleared except the collaboration cluster**: phase2-build1 cleared the picker/room-sync (#4) and unblocked connectors (#5) + remove (#6); phase2-build2 cleared the connector arrowhead; **phase2-build3 cleared the three standalone slices (#7/#8/#9)**. Remaining:
  - **collaboration polish (next suggested cluster)**: #3 mandatory name-on-join gate (joiners currently show as "guest"), #1 re-open the share link after first use, #10 a show-piece room name on the board, #2 move presence to a left rail. Brief to be authored.
  - Out of scope still: the animated/elastic connector that stretches WHILE dragging (Brief 8 R7 deliberately hides on drag, redraws on drop) — deferred.
- **#7 demo/clear is local-only by ruling**: do NOT add `NEW_PLAN`/`LOAD_PLAN` to the room op-loop. A failed demo fetch flashes a reason and changes nothing (atomic, like Import).
- **Cycle detection still deferred** (by ruling): self-dep + duplicate-pair rejected at picker + load boundary; the duplicate check is DIRECTIONAL; a true cycle yields honest mutual violation flags, no DFS.
- **`@suite/auth-client` is a deploy-time/file dependency, NOT in `package.json`** (it would break `npm ci` where suite is absent) — installed on the box via `--no-save`. Vendoring it for clean redeploys is an open launch follow-up.
- **Company-level entitlement** currently covers just the launcher's user (open follow-up logged at launch).
- **Sibling theme re-sync is OPEN** (suite-level, not a plan task): signal/retro/poker/raid owe a sync commit each after the Brief 10 plum/glyph promotion.
- **Dragula vendoring decision stands** (`docs/housekeeping-dragula-vendoring.md`): keep per-app copies.
- **Doc/code naming note** (Brief 6): `extractPlan`'s upload mode is `"file"` in code.

---

## Commands

```
npm test               # npm run drift && node --test tests/*.test.js — 191 tests (drift gate first)
npm run drift          # theme-drift check against the shared suite source
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve the static app on http://localhost:3004 (local single-user)
npm run rooms          # PROD room service (server/start.js), PORT 3014; needs /var/www/plan/data/ (deploy artifact)
node server/dev-rooms.js   # LOCAL two-client UAT: static + ws on :3014 (binds 0.0.0.0), seeds an open-link "demo" room
```

Local two-client room UAT: run `node server/dev-rooms.js`, then open two browsers at
`http://localhost:3014/?room=demo&token=demo&name=Alice` and `…&name=Bob`. The room store boots
from the server's authoritative `state` frame (no localStorage). Local mode (incl. demo/clear, which
hide in a room) = the same URL with no `?room=` param. Note: `npm run rooms` is the PROD entrypoint
and expects `/var/www/plan/data/` to exist; for local UAT use `dev-rooms.js` (in-memory db).

## Branch / merge model

`main` carries briefs 1–10, the Phase 2 spike + MP1–MP6 slices + the launch follow-ups, and
phase2-build1 (PR #26), all merged with merge commits (not squash/rebase) so the build-log's
per-build SHA references stay valid. **phase2-build2 merged the same way (PR #27, `a2d132c`)**,
followed by doc-only PRs #28 (`f2e03a8`), #29 (`6ed0599`), #30, then **phase2-build3 (PR #31,
`f2be8dd`)**, the dev-bind fix (PR #32, `cf2a800`), and the build3 sign-off/SHA bump (PR #33,
`abcb1b0`). Per-build feature branches off `main`. The rooms service's suite-side pieces (hub
registration, theme) live in `davidmjackson/suite`.

---

## Suggested next session

**collaboration polish** — the alternative cluster from the post-launch UAT, now the front-runner:
#3 mandatory name-on-join gate, #1 re-open the share link after first use, #10 a show-piece room
name on the board, #2 move presence to a left rail. Brief to be authored. RoE cadence applies:
PROPOSE before building; feature branch per build. (Scope order is the director's call.)
