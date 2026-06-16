# Build state after phase2-build1 — handoff (multiplayer LIVE; dependency room-sync defect fixed)

**Purpose**: Ground the next session in what the code *actually is* after phase2-build1, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build. This snapshot supersedes `build-state-after-brief10.md` (now in `docs/archive/`), which predated the entire Phase 2 multiplayer arc. **The MVP shipped (briefs 1–10), then Phase 2 added live multiplayer rooms (spike → MP1–MP6 → live launch), and this build fixed the first post-launch UAT defect: dependencies did not sync inside a shared room.**

**As of**: `main` at `db8533f` (PR #26 merged). Tree: **185 unit/integration tests green** (`npm test`, which runs the theme-drift gate *first*), `tsc --noEmit` clean, theme-drift `ok: /var/www/plan`. `origin == local`, working tree carries only a kept whitespace edit in `build-log.md` (director's call, see that file).

**Companions**: sprintplan-mvp-spec.md, aide-rules-of-engagement.md, build-log.md, docs/README.md, phase2-build1.md, housekeeping-dragula-vendoring.md, demo-data.md, and `docs/archive/` (briefs 1–10, their build-states, and the phase2 MP1–6 + spike briefs/findings).

---

## What phase2-build1 shipped (this build)

**The dependency feature was dead in a shared room — fixed as a view-layer defect.** A facilitator in a room opened a story, clicked "This needs…"/"This blocks…", picked a target, and nothing appeared: no row, no badge, no link. It worked in the local single-user app.

- **Root cause**: the room store is **pessimistic** (`sync-client.js`) — `dispatch` *sends* an op and does NOT mutate local state; the store changes only when the server echoes the applied op back. The card editor was written against the **synchronous local store**: it called `renderRows()`/`refreshEpicOptions()` immediately after dispatch (reading stale, in-flight state) and never subscribed, so the server echo never re-rendered the open modal. The inline "+ New epic" add had the identical flaw.
- **The fix (view-layer only, R1–R5)**: one store subscription in `openCardEditor` (`syncFromState`) drives **both** the Dependencies rows and the epic select; the post-dispatch synchronous re-renders are dropped; new-epic selection is deferred to the notification; `modal.js` gained a one-line `onClose` hook that unsubscribes on **every** close path (no stacked subscriptions on reopen). One code path, correct under both the synchronous local store and the pessimistic room store — the view cannot tell which it holds.
- **Files**: `public/js/card-editor.js` + a one-line `public/js/modal.js` hook. **No** model/action/schema/reducer/selector/protocol/board-connector change.
- **Added**: `tests/phase2-build1-deps-room-sync.test.js` (two real room stores over a real socket prove LINK/UNLINK_DEP round-trip to both clients with no nack — the "verify, don't assume" second-order gate) and `server/dev-rooms.js` (a local two-client UAT launcher: seeds a demo open-link room, serves static + ws on one port).
- **Verified**: suite 185/185, typecheck, drift green; browser two-client UAT — all 7 asserted cases pass (local instant; room editor row + badge on both; connector draws once both placed; remove clears both; room-created epic selects; no stacked subs; zero console errors).

---

## The Phase 2 multiplayer arc (shipped between brief10 and this build)

`build-state-after-brief10.md` did not cover any of this. Live on sprintplan.uk; the build-log has a full entry per slice.

- **Dual-mode boot (`main.js`)**: a `?room=` URL param forks to a server-authoritative room store over a WebSocket; **absent the param the local single-user app is byte-for-byte unchanged** (still localStorage autosave + the Brief 6 resume prompt). Room mode SKIPS autosave and the resume gate (the server owns persistence — touching `sprintplan:board` would clobber the user's local plan).
- **The store interface is the seam**: `createRoomStore` (`sync-client.js`) mirrors `createStore`'s `{getState, dispatch, subscribe}`, so **every view module is reused unchanged**. The room store reuses the shipped `reduce()` and `validatePlan()` BY IMPORT — it applies exactly the op the server confirms, in the server's order. EDIT_STORY is sent as a field-delta; everything else whole.
- **Server (`server/`, promoted from the throwaway `spike/`)**:
  - `server.js` — an always-on express app: `express.static` serving (dev/optional), `POST /rooms` (auth-gated room creation, optionally seeded from a posted+validated plan), auth routes, and the ws upgrade (awaits `provider.verifySession`, enforces the per-room open-link-vs-company-only policy).
  - `rooms.js` — the serialized op loop + broadcast and the **op allow-list** (LINK_DEP/UNLINK_DEP are in it — confirmed during phase2-build1; the dep defect was NOT a protocol gap).
  - `db.js` — better-sqlite3 room store. `auth.js` — `createAuthProvider({env})`: a STUB by default, or a REAL `@suite/auth-client` adapter loaded by **dynamic import** behind `HUB_BASE_URL` (so module load + CI never need the package or a hub). `auth-seam.js` — the stub seam.
  - `start.js` — the systemd production entrypoint (PORT default 3014; `SERVE_STATIC` off in prod, apache owns static). `dev-rooms.js` — **NEW this build**, local-only UAT launcher.
- **Slices**: MP1 client sync + open-link rooms · MP2 company-only rooms + real auth seam · MP3 EDIT_STORY field-delta merge (different-field edits merge server-side, same-field is last-write-wins, no false-conflict; the global-version gate dropped) · MP4 collaborate bridge (`collaborate.js`: create a room from the current plan + share link, gated behind a session) · MP5 presence (a side-channel `#presence` strip, room-mode only, that NEVER touches plan state/version) · MP6 deploy (hardened `sprintplan-rooms` systemd service, apache same-origin reverse proxy for ws + `/rooms` + `/auth/*`, hub registration, entitlement).

---

## Architecture as built (the contract a future brief extends)

Everything from briefs 1–10 still holds. **The entire Phase 2 arc added NO action, NO schema change, NO reducer change to the shipped model (R2 throughout).**

- **State shape, actions, schema — UNCHANGED**: still `schemaVersion: 2`, `deps: [{ id, blockerId, blockedId }]`, **17 actions**, `validatePlan` the load-path spine. The room layer is additive (a wire-backed store + a server op loop), not a model rewrite.
- **Views react to store NOTIFICATIONS, not to the return of dispatch** — this is the phase2-build1 lesson and now the standing rule for any view that commits live (deps, and the new-epic options). It is the ONE discipline that makes a view correct under both stores: the synchronous local store notifies in the same call stack (still feels instant); the pessimistic room store notifies later, on the server echo. Subscriptions added by a modal MUST be torn down on close (the `modal.js` `onClose` hook).
- **The board/connector layer draws from state on notify** (Brief 8) and "comes good for free" once a link creates — confirmed in the UAT. Connectors/tethers are **board-to-board**: a backlog endpoint has no board position, so no line draws until both endpoints are placed (not a bug).
- **Theme source of truth is the shared suite repo** (Brief 10): do NOT edit `public/css/instrument-core.css`, `public/js/oscilloscope.js`, or `public/illos/glyphs.svg` here — they are synced artifacts and the drift gate will go red. `public/css/plan.css` is plan-local.
- **plan's local mode stays account-free and backend-free**; the room service is a SEPARATE process (systemd `sprintplan-rooms`) reached via the apache reverse proxy. The static site and the rooms service share an origin in production.

---

## Known limitations / carried forward

- **NEXT BUILD — connector arrowhead points at the line, not the depended-on story.** A pre-existing `connectors.js` (Brief 8) direction/anchor defect, invisible until room deps started drawing. Found in the phase2-build1 UAT; parked per the no-"while we're here" rule (R3). Its own phase2-buildN.
- **The UAT backlog (ten items, from the post-launch UAT session)**: this build cleared #4 (picker dead in a room) and unblocked #5 (connectors draw) + #6 (remove control). Remaining — suggested sequencing:
  - **phase2-build2 (collaboration polish)**: #3 mandatory name-on-join gate (joiners currently all show as "guest"), #1 re-open the share link after first use, #10 a show-piece room name on the board, #2 move presence to a new left rail.
  - **phase2-build3 (standalone slices)**: #7 one-click demo load/clear, #8 plan-capacity bar under the settings strip, #9 return a placed story to the backlog.
  - Out of scope still: the animated/elastic connector that stretches WHILE dragging (Brief 8 R7 deliberately hides on drag, redraws on drop).
- **Cycle detection still deferred** (by ruling): self-dep + duplicate-pair rejected at picker + load boundary; the duplicate check is DIRECTIONAL; a true cycle yields honest mutual violation flags, no DFS.
- **`@suite/auth-client` is a deploy-time/file dependency, NOT in `package.json`** (it would break `npm ci` where suite is absent) — installed on the box via `--no-save`. Vendoring it for clean redeploys is an open follow-up from the launch.
- **Company-level entitlement** currently covers just the launcher's user (open follow-up logged at launch).
- **Sibling theme re-sync is OPEN** (suite-level, not a plan task): signal/retro/poker/raid owe a sync commit each after the Brief 10 plum/glyph promotion.
- **Dragula vendoring decision stands** (`docs/housekeeping-dragula-vendoring.md`): keep per-app copies.
- **Doc/code naming note** (Brief 6): `extractPlan`'s upload mode is `"file"` in code.

---

## Commands

```
npm test               # npm run drift && node --test tests/*.test.js — 185 tests (drift gate first)
npm run drift          # theme-drift check against the shared suite source
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve the static app on http://localhost:3004 (local single-user)
npm run rooms          # the room service (server/start.js), PORT default 3014
node server/dev-rooms.js   # LOCAL two-client UAT: static + ws on :3014, seeds an open-link "demo" room
```

Local two-client room UAT: run `node server/dev-rooms.js`, then open two browsers at
`http://127.0.0.1:3014/?room=demo&token=demo&name=Alice` and `…&name=Bob`. The room store boots
from the server's authoritative `state` frame (no localStorage). Local mode = the same URL with no
`?room=` param.

## Branch / merge model

`main` carries briefs 1–10, the Phase 2 spike + MP1–MP6 slices + the launch follow-ups, and
phase2-build1 (PR #26), all merged with merge commits (not squash/rebase) so the build-log's
per-build SHA references stay valid. Per-build feature branches off `main`. The rooms service's
suite-side pieces (hub registration, theme) live in `davidmjackson/suite`.

---

## Suggested next session

**phase2-build2 — collaboration polish** (name-on-join #3, re-open share link #1, room name #10,
presence left rail #2), OR pick the connector-arrowhead fix as a focused defect build first. Scope
order is the director's call. RoE cadence applies: PROPOSE before building; feature branch per build.
