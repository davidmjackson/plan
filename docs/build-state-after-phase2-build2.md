# Build state after phase2-build2 — handoff (dependency arrow now points at the depended-on story)

**Purpose**: Ground the next session in what the code *actually is* after phase2-build2, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build. This snapshot supersedes `build-state-after-phase2-build1.md` (now in `docs/archive/`). **The MVP shipped (briefs 1–10), Phase 2 added live multiplayer rooms (spike → MP1–MP6 → live launch), phase2-build1 fixed the dependency room-sync defect, and this build fixed the connector arrowhead — the second post-launch UAT defect: the dependency arrowhead pointed flat along the line instead of at the depended-on story.**

**As of**: phase2-build2 **merged to `main` via PR #27** (merge commit `a2d132c`, feature work `1146837`). Two doc-only follow-ups then merged: **PR #28** (`f2e03a8`) — the `dep-selectors.js` head-at-blocker JSDoc fix + post-review note; **PR #29** (`6ed0599`) — the phase2-build3 brief + log entry. **`main` now at `6ed0599`**, `origin == local`. Tree: **185 unit/integration tests green** (`npm test`, which runs the theme-drift gate *first*), `tsc --noEmit` clean, theme-drift `ok: /var/www/plan`.

**Companions**: sprintplan-mvp-spec.md, aide-rules-of-engagement.md, build-log.md, docs/README.md, phase2-build2.md, housekeeping-dragula-vendoring.md, demo-data.md, and `docs/archive/` (briefs 1–10, their build-states, the phase2 MP1–6 + spike briefs/findings, and build-state-after-phase2-build1.md).

---

## What phase2-build2 shipped (this build)

**The dependency arrowhead pointed at the line, not at a story — fixed as a pure view-layer geometry change.** A pre-existing **Brief 8** defect in `connectors.js`, invisible until dependencies actually drew inside a shared room (surfaced in the phase2-build1 UAT and parked there per the no-"while we're here" rule).

- **Root cause (two coupled issues in `connectors.js`)**:
  1. **Orientation** — `curvePath` anchored both endpoints on the cards' right edges and set the end control point flat to the right at the same `y`, so the cubic's end tangent was `(−bow, 0)` — purely horizontal, decoupled from where the other card sat. The head read flat "on the line" regardless of the real direction.
  2. **Direction** — the marker sat at the path end = the *blocked* (dependent) card, per Brief 8's documented "arrowhead at the dependent end".
- **The director's ruling (R2, confirmed before any geometry moved)**: the head points at the **depended-on (blocker)** story — **consciously reversing Brief 8's documented dependent-end convention**. The two source docs genuinely disagreed (archived Brief 8 vs this brief's goal text); the call was the load-bearing decision of the build.
- **The fix (pure view, board-only)**: the path now ends at the **blocker** (head moves to the depended-on story), and the end control point offsets **vertically toward the blocked card** (`dirY = sign(y1 − y2)`, `c2y = y2 + dirY·bow`) so the final tangent tilts along the real blocker↔blocked axis and the head drives *into* the target card. Same path serves both tethers and connectors → both corrected (R4).
- **Files**: `public/js/connectors.js` only. The fix needs only `right`/`midY`, which `cardRect` already returned — so **`cardRect` is unchanged and there is NO CSS change**. Net diff: `curvePath` end-geometry + the call-site rename to `blocker`/`blocked`. **No** model/selector/store/schema change (R1); violation red (`context-stroke`), the shared `#dep-arrow` marker, hover-gating, and drag suppress/redraw all untouched (R3).
- **Verified**: suite 185/185, typecheck, drift green; two-client browser UAT via `server/dev-rooms.js` — connector + tether, neutral + violation, local + room, stable across drag/dragend, zero console errors. Director signed off.

---

## The dependency feature, end to end (now complete and correct)

The full P0 #5 "Story-to-story dependency link" is now correct in every surface:

- **Model/selectors (briefs 7)** — `deps: [{ id, blockerId, blockedId }]`; `isViolation` (both placed AND blocked sits in a strictly earlier sprint than its blocker); `connectorsToDraw` (one entry per pair with both endpoints placed; `kind` tether/connector; carries `blockerId`/`blockedId`/`violation`). Pure, DOM-free, unit-tested. **Untouched by this build.**
- **Card editor (briefs 7, phase2-build1)** — links created/removed in the editor ONLY; the editor reacts to store **notifications**, so it is correct under both the local and the pessimistic room store.
- **Board layer (Brief 8, phase2-build2)** — tethers always visible, cross-sprint connectors on hover, board-side violation red. **The arrowhead now points at the depended-on (blocker) story** and drives into the card.

---

## Architecture as built (the contract a future brief extends)

Everything from briefs 1–10 and the Phase 2 arc still holds. **The entire Phase 2 arc + both post-launch builds added NO action, NO schema change, NO reducer change to the shipped model (R2 throughout).**

- **State shape, actions, schema — UNCHANGED**: still `schemaVersion: 2`, `deps: [{ id, blockerId, blockedId }]`, **17 actions**, `validatePlan` the load-path spine.
- **Dual-mode boot (`main.js`)**: a `?room=` URL param forks to a server-authoritative room store over a WebSocket; absent the param the local single-user app is byte-for-byte unchanged (localStorage autosave + the Brief 6 resume prompt). The store interface (`{getState, dispatch, subscribe}`) is the seam, so every view module is reused unchanged across both stores.
- **Views react to store NOTIFICATIONS, not to the return of dispatch** (the phase2-build1 standing rule). Subscriptions a modal adds MUST be torn down on close (the `modal.js` `onClose` hook).
- **The board/connector layer is a PURE VIEW over `connectorsToDraw` + the carried violation flag** (Brief 8 R1). It dispatches nothing and never touches deps/store/schema. Connectors/tethers are **board-to-board**: a backlog endpoint has no board position, so no line draws until both endpoints are placed (not a bug). The overlay is recreated on every `renderBoard` (replaceChildren); endpoints are re-queried by `[data-story]` after layout, never cached. The arrowhead convention is now **head-at-blocker** (depended-on); the single shared `#dep-arrow` marker uses `fill: context-stroke` so it follows neutral/violation stroke.
- **Server (`server/`)**: `server.js` (express + ws upgrade + `POST /rooms`), `rooms.js` (serialized op loop + broadcast + op allow-list incl. LINK/UNLINK_DEP), `db.js` (better-sqlite3), `auth.js` (stub by default; real `@suite/auth-client` via dynamic import behind `HUB_BASE_URL`), `start.js` (systemd prod entrypoint, PORT 3014), `dev-rooms.js` (local two-client UAT launcher).
- **Theme source of truth is the shared suite repo** (Brief 10): do NOT edit `public/css/instrument-core.css`, `public/js/oscilloscope.js`, or `public/illos/glyphs.svg` here — synced artifacts, the drift gate goes red. `public/css/plan.css` is plan-local.
- **plan's local mode stays account-free and backend-free**; the room service is a SEPARATE process (systemd `sprintplan-rooms`) reached via the apache same-origin reverse proxy.

---

## Known limitations / carried forward

- **The UAT backlog (from the post-launch UAT session)**: phase2-build1 cleared the picker/room-sync (#4) and unblocked connectors (#5) + remove (#6); **phase2-build2 cleared the connector arrowhead** (the parked Brief 8 geometry defect). Remaining — suggested sequencing:
  - **phase2-build3 (standalone slices, next brief)**: #7 one-click demo load/clear, #8 plan-capacity bar under the settings strip, #9 return a placed story to the backlog.
  - **collaboration polish (a later build)**: #3 mandatory name-on-join gate (joiners currently show as "guest"), #1 re-open the share link after first use, #10 a show-piece room name on the board, #2 move presence to a left rail.
  - Out of scope still: the animated/elastic connector that stretches WHILE dragging (Brief 8 R7 deliberately hides on drag, redraws on drop) — deferred, NOT justified by the arrowhead defect.
- **Cycle detection still deferred** (by ruling): self-dep + duplicate-pair rejected at picker + load boundary; the duplicate check is DIRECTIONAL; a true cycle yields honest mutual violation flags, no DFS.
- **`@suite/auth-client` is a deploy-time/file dependency, NOT in `package.json`** (it would break `npm ci` where suite is absent) — installed on the box via `--no-save`. Vendoring it for clean redeploys is an open launch follow-up.
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
per-build SHA references stay valid. **phase2-build2 merged the same way (PR #27, `a2d132c`)**, followed by doc-only PRs #28 (`f2e03a8`) and #29 (`6ed0599`).
Per-build feature branches off `main`. The rooms service's suite-side pieces (hub registration,
theme) live in `davidmjackson/suite`.

---

## Suggested next session

**phase2-build3 — standalone slices**: one-click demo load/clear (#7), a plan-capacity bar under
the settings strip (#8), return a placed story to the backlog (#9). Brief `docs/phase2-build3.md`
to be authored. RoE cadence applies: PROPOSE before building; feature branch per build. (Scope
order is the director's call — collaboration polish is the alternative cluster.)
