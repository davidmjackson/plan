# Build state after phase2-build6 — handoff (story-level "stretch" toggle; the deliberate model extension)

**Purpose**: Ground the next session in what the code *actually is* after phase2-build6, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build. This snapshot supersedes `build-state-after-phase2-build5.md` (now in `docs/archive/`). **The MVP shipped (briefs 1–10), Phase 2 added live multiplayer rooms (spike → MP1–MP6 → live launch), then post-launch builds: build1–build4 cleared the UAT backlog, build5 added live cursors + coloured avatars (sealed model), and phase2-build6 is the deliberate INVERSE of build5 — the first intentional schema-and-op extension since the dependency work: a story-level "stretch" toggle (P1).**

**As of**: phase2-build6 **shipped via PR #38** (merge commit `MERGE_SHA`). **`main` now at `MERGE_SHA`.** `origin == local`. Tree: **233 unit/integration tests green** (`npm test`, drift gate first), `tsc --noEmit` clean, theme-drift `ok: /var/www/plan`. Director signed off ("all good") after a local-mode + two-browser-room UAT.

**Companions**: sprintplan-mvp-spec.md, aide-rules-of-engagement.md, build-log.md, docs/README.md, phase2-build6.md, housekeeping-dragula-vendoring.md, demo-data.md, and `docs/archive/` (briefs 1–10, the phase2 MP1–6 + spike briefs/findings, the post-launch build1–5 briefs, and build-states after build1–build5).

---

## What phase2-build6 shipped (this build)

A facilitator can mark a placed story a **stretch goal**: it stays FULLY counted in the sprint total and pill, and is called out separately in the export, so the over-commitment stays on the record (the literal enforcement of the Brief 4 banner). PROPOSE was ruled in chat (David: "happy", accepted all; folded into R1–R7).

- **Schema v2 → v3** through the existing `migratePlan` seam: `CURRENT_SCHEMA = 3`, `MIGRATORS[2]` is a **version-bump only** (`stretch` is optional, absent reads false, no per-story backfill), `createInitialState` stamps v3. `validatePlan` gained NO stretch gate (non-structural scalar; R2). An existing v2 save/file migrates and loads with zero data loss (tested as a data-continuity case).
- **New action `SET_STORY_STRETCH { id, stretch }`** — an explicit boolean (LWW-clean in a room), not a flip. Reducer writes the flag and preserves every other field; **an unknown id is a guarded no-op** (`if (!(id in state.stories)) return state`) so it never spreads `undefined` into a phantom story.
- **Allow-list now 11 ops**: `SET_STORY_STRETCH` added to `ALLOWED` in `rooms.js`; both stale "9 wire ops" doc-comments corrected to "11 wire ops". A whole-payload server-DATA op (changes `room.doc`); `sync-client.js` needed no change (whole-payload actions already ride dispatch).
- **The honesty invariant (R1) — the line this build holds**: marking stretch NEVER changes a sprint's placed total, its pill colour, or the plan-capacity bar. `board-selectors.js` and `plan-maths.js` are byte-for-byte untouched; stretch stories stay counted in full. Asserted directly (not assumed): `sprintPlacedPoints`/`pillState`/`planBarData.tone`+`planned` are byte-identical before and after a mark.
- **UX (R4/R5)**: an in-place **toggle** + a muted **"stretch" chip** on the PLACED branch of `storyCard` (in `backlog.js`), live-committing via the `#board` delegated listener's new `toggle-stretch` branch (works in BOTH local and room mode — a real action, not an ephemeral side-channel like build5 cursors). Excluded as a drag handle in `drag.js`. Neutral soft/bone tones only — never amber/red (capacity / violation), never plum-as-status. The flag persists in data if a stretch story is moved to the backlog but renders nothing there.
- **Report (R6)**: `StoryRow.stretch`; per-sprint `stretchPoints`; a CSV `stretch` column (placed `yes`/blank, backlog blank); the over-commitment "of which M pts marked stretch" split with the FULL overage retained; a per-sprint stretch marker in md/html. A plan with no stretch reads exactly as before.

- **Files**: new `tests/store-stretch.test.js` (reducer + the honesty invariant); additions to `tests/plan-io.test.js` (v2→v3 + data-continuity), `tests/report.test.js` (stretch dimension), `tests/spike-op-loop.test.js` (the +1 allow-list op). Modified `public/js/store.js` (Story `stretch?`, v3, `SET_STORY_STRETCH` case), `public/js/actions.js`, `public/js/plan-io.js`, `server/rooms.js`, `public/js/report.js`, `public/js/backlog.js` (chip+toggle), `public/js/main.js` (listener branch), `public/js/drag.js`, `public/css/plan.css`.
- **Untouched (the R1 invariant)**: `public/js/board-selectors.js`, `public/js/plan-maths.js`, `validatePlan`'s checks, `public/js/sync-client.js`, `public/js/render.js` (it only calls `storyCard`; the renderer itself lives in `backlog.js`).

### Brief correction worth carrying

The brief attributed the shared `storyCard` renderer to `render.js`; it actually lives in **`backlog.js`** (render.js imports and calls it with `placed=true`). The chip+toggle went into backlog.js and render.js was untouched. (Source-over-handoff, as the README directs.)

---

## Architecture as built (the contract a future brief extends)

Everything from briefs 1–10, the Phase 2 arc, and build1–5 still holds. **The model grew deliberately this build: schema v3, one optional story field, one action, one allow-list entry.**

- **State shape**: `meta.schemaVersion` is now **3**; `Story` gains an optional `stretch?: boolean` (absent = false). `deps: [{ id, blockerId, blockedId }]` unchanged.
- **Actions — now 18**: the prior 17 + `SET_STORY_STRETCH`. Creators still return plain `{type, payload}`; the reducer is total (throws on unknown).
- **Schema seam (`plan-io.js`)**: `CURRENT_SCHEMA = 3`; `MIGRATORS = { 1: v1→v2 (deps), 2: v2→v3 (version bump) }`; `migratePlan` walks one version at a time; a version newer than 3 fails clearly. `validatePlan` is unchanged (stretch is non-structural).
- **Room op allow-list (`server/rooms.js`)** is now **11 ops**: the 9 structural ops + `SET_PLAN_TITLE` (build4) + `SET_STORY_STRETCH` (build6). `NEW_PLAN`/`LOAD_PLAN`/settings ops remain excluded.
- **The capacity authorities stay the single source of truth and are stretch-blind**: `placedPoints`, `sprintPlacedPoints`, `planCapacity`, `planBarData`, `sprintCapacity`, `pillState`, `overBy`. Stretch is recorded intent + a report annotation, never a capacity discount (R1). The report's `stretchPoints` is a SUBSET annotation of the placed total, computed in `report.js`, never subtracted.
- **`storyCard` (`backlog.js`)** is the shared board/backlog renderer; its `placed` branch carries the return-to-backlog control, the D-badge, and now the stretch chip + toggle. `render.js` passes `placed=true` for board cards.
- **The `#board` delegated listener (`main.js`)** routes `edit-story` / `dismiss-banner` / `return-to-backlog` / **`toggle-stretch`**. `drag.js` excludes both `return-to-backlog` and `toggle-stretch` as drag handles.
- **Views react to store NOTIFICATIONS**; the room store is pessimistic. Presence + cursors remain ephemeral side-channels (MP5/build5), never reduced into the doc. Arrowhead convention is head-at-blocker (build2).
- **Server (`server/`)**: `server.js` (express + ws upgrade + `POST /rooms`; `meta.colour` + cursor relay from build5; `startSpikeServer` optional `host`, default `127.0.0.1`), `rooms.js` (op loop + the 11-op allow-list), `db.js`, `auth.js`, `start.js` (PORT 3014), `dev-rooms.js` (local UAT launcher, binds `0.0.0.0`).
- **Theme source of truth is the shared suite repo**: do NOT edit `instrument-core.css`, `oscilloscope.js`, `glyphs.svg`. `public/css/plan.css` is plan-local.

---

## Known limitations / carried forward

- **Stretch is placed-only and intentionally minimal**: no toggle in the card editor, none on backlog cards, no capacity gating (available on any placed story), no "promote stretch to committed" bulk action, no stretch filter/view, no stretch in the plan-bar label. All parked on the director's one-slice call.
- **The flag persists in data if a stretch story is moved to the backlog** (no data loss, no surprise clearing) but renders nothing there and is blank in the CSV.
- **The honesty model is unchanged**: the banner, pill, and capacity maths are exactly as before; stretch reinforces the banner, it does not alter it.
- **MP5 parking lot** (still parked): per-card "X is editing" / drag ghosting; cursors in modals; **backlog cursors** (build5 P3, easy follow-on); idle-timeout / smoothing / heartbeat; touch cursors; cross-tab dedupe.
- **Standing**: cycle detection deferred; `@suite/auth-client` vendoring open; company-level entitlement covers only the launcher's user; sibling theme re-sync open at suite level; dragula vendoring stays per-app; `extractPlan` upload mode is `"file"`.

---

## Commands

```
npm test               # npm run drift && node --test tests/*.test.js — 233 tests (drift gate first)
npm run drift          # theme-drift check against the shared suite source
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve the static app on http://localhost:3004 (local single-user)
npm run rooms          # PROD room service (server/start.js), PORT 3014; needs /var/www/plan/data/
node server/dev-rooms.js   # LOCAL UAT: static + ws on :3014 (binds 0.0.0.0), seeds an open-link "demo" room
```

Local stretch UAT: run `node server/dev-rooms.js` **in your own terminal** (a backgrounded server is reaped between agent turns), open `http://localhost:3014/` (local mode, no `?room=`), place a story and tap the ✦ toggle — the chip appears and the pill / sprint total / plan-bar do NOT move; export to see the stretch split; load an older v2 board to confirm a clean v3 resume. Two-browser room: `…/?room=demo&token=demo&name=Alice` + `&name=Bob`. **If Windows `localhost:3014` won't load, use the WSL IP (`hostname -I`) — a known WSL2 localhost-forwarding flake, not a build fault.** Restart the dev server after any `server/*.js` change (Node does not hot-reload).

## Branch / merge model

`main` carries briefs 1–10, the Phase 2 spike + MP1–MP6 + launch follow-ups, build1 (PR #26), build2 (#27 `a2d132c`; docs #28–#30), build3 (#31 `f2be8dd`; dev-bind #32 `cf2a800`; #33 `abcb1b0`; #34 `460de4a`), build4 (#35 `fac0266`; #36 `987aa00`), build5 (#37 `c6a4c68`; docs/SHA `9845220`; docs-tidy `6506a4f`), and **build6 (PR #38, `MERGE_SHA`)** — all merge commits so the build-log's per-build SHA references stay valid. Per-build feature branches off `main`.

---

## Suggested next session

**No queued backlog.** The next session is the director's net-new direction. Natural follow-ons: a stretch view/filter or "promote to committed" (build on this slice); backlog cursors (build5 P3); per-card editing indicators (MP5 parking lot). Standing streams: `@suite/auth-client` vendoring; company-level entitlement; suite-level theme re-sync; persisted/renamable named rooms (the first server-DATA change of the room arc). RoE cadence applies: PROPOSE before building; feature branch per build.
