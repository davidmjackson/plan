# Build state after Brief 2 — handoff for the next brief

**Purpose**: Ground the next brief in what the code *actually is* after Brief 2, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build; intended for the Claude app (Fable) when authoring Brief 3.
**As of**: commit `23e23ca` on branch `brief-2-backlog-cards` (pushed to origin; branched off Brief 1's branch, so it carries both briefs' commits).
**Companions**: sprintplan-mvp-spec.md (v0.5), v1-screen-designs.md (v1.0), user-journeys.md (v1.0), aide-rules-of-engagement.md, build-log.md, build-state-after-brief1.md.

---

## What Brief 2 shipped

The backlog panel and the epic/story cards that fill it. A facilitator can create epics and child stories (title, summary, points), see them grouped by epic in the right-hand panel with a "No epic" bucket, and edit or delete either through modal editors. **Stories live in the backlog only** — they are not yet placed into sprints (that is drag-and-drop, Brief 3). Capacity pills still read `0 / capacity`.

Verified: 57/57 unit tests; `tsc --noEmit` clean; headless Chromium drove the real editors end-to-end (create epic → plum; add story; points-0 rejected with the modal held open; No-epic bucket; `DELETE_EPIC 'delete'` removed exactly an epic's children and left unrelated stories intact) with zero console errors.

---

## Architecture as built (the contract Brief 3 extends)

Everything from `build-state-after-brief1.md` still holds (single store, pure reducer, serializable actions, capacity derived-not-stored, calendar dates as strings, inclusive-day counting, `@ts-check` gate scoped to `public/js`). Brief 2 added card data and editors **without new architecture**. New invariants now load-bearing:

- **A story's location is array membership, never a field.** A story id sits in `backlog[]` (front = top, the G3 "returned" slot) or in exactly one sprint's `placedStoryIds[]`. There is no `sprintId`/`location` on the story object. **Brief 3's drag-and-drop must preserve this** — a move is "remove the id from its current array, insert into the target array."
- **Ids are minted in action creators, not the reducer** (`ids.js`), so `reduce` stays pure and deterministic.
- **`colourKey` is assigned by the reducer** by rotation (`PALETTE[epicCount % len]`); the store holds the key only, colour values live in `plan.css`.
- **Deletes are atomic and the only path that removes a card.** `DELETE_EPIC` reparents (`mode:"reparent"`) or cascades (`mode:"delete"`) with no orphans or half-state.
- **Modal open/closed and dirty state is VIEW state, never in the store.** The store only hears committed `ADD_*`/`EDIT_*`/`DELETE_*` actions.

### Current state shape

```js
{
  meta:     { title: string | null, schemaVersion: 1 },
  settings: { startDate, durationMonths, sprintWeeks, velocity, bufferPct },
  sprints:  [ { index, name, startDate, endDate, days, isPartial, placedStoryIds: [] } ],
  backlog:  [ /* story ids; front = top (reserved G3 "returned" position) */ ],
  epics:    { [id]: { id, title, colourKey } },
  stories:  { [id]: { id, title, summary, points, epicId: string | null } },
  lastReturnedStoryIds: []   // transient; drives the "returned to backlog" toast
}
```

`placedStoryIds` is still empty in normal use (nothing places stories yet) but is fully wired through regeneration and is where Brief 3 will put moved stories.

### Action vocabulary — SHIPPED (complete current set, 14 actions)

Settings/plan (Brief 1): `SET_START_DATE`, `SET_DURATION_MONTHS`, `SET_SPRINT_WEEKS`, `SET_VELOCITY`, `SET_BUFFER_PCT`, `SET_PLAN_TITLE`, `NEW_PLAN`, `LOAD_PLAN`.
Cards (Brief 2): `ADD_EPIC`, `EDIT_EPIC`, `DELETE_EPIC`, `ADD_STORY`, `EDIT_STORY`, `DELETE_STORY`.

**Not yet built:** `MOVE_STORY` (drag-and-drop, Brief 3) and `LINK_DEP` (dependencies, a later brief). `MOVE_STORY` is the obvious next action: it would reuse the existing private `removeIdFromArrays(state, id)` helper in `store.js`, then insert the id into the target array (backlog or a sprint's `placedStoryIds`) at a given position.

### Pure functions available (all unit-tested, DOM-free)

- Brief 1: `date.js`, `plan-maths.js` (incl. `sprintCapacity`, `pillState`), `month-rail.js`, `regenerate.js`
- Brief 2: `validate.js` (`parsePoints`, `isNonEmptyTitle`), `backlog-selectors.js` (`backlogGroups`, `epicSummary`), `epic-palette.js` (`PALETTE`)

### View modules (Brief 2)

`dom.js` (`el` helper), `modal.js` (shell + unsaved-changes guard, returns `{ close, attemptClose, card }`), `backlog.js` (renders panel from selectors; collapse is module-local view state), `card-editor.js`, `epic-editor.js`. Wired by a single delegated click listener in `main.js` (nodes carry `data-act` / `data-epic` / `data-story`).

---

## What Brief 3 (drag-and-drop, P0 #3) will need to touch

- **`MOVE_STORY` action** (backlog→sprint, sprint→sprint, sprint→backlog, reorder within a sprint). Pure reducer, unit-tested; must keep location-as-array-membership and conserve every id.
- **dragula is NOT yet vendored in `plan/`** — the suite has it at `retrospective/public/vendor/dragula/`. Copy it into `plan/public/vendor/dragula/` (the spec mandates a mature DnD library, not hand-rolled).
- **The board does not yet render placed cards.** `render.js` `renderBoard` computes `placed = sprint.placedStoryIds.length` for the pill but the sprint body is always the static "Drop stories here". Brief 3 must render story cards inside sprint containers (reusing the card visual from the backlog) and make them drag sources/targets.
- **Capacity pills become meaningful for the first time** — once stories are placed, `placed` is non-zero and the neutral/amber/red logic (already built and tested in `plan-maths.js`) lights up. The **capacity honesty banner (P0 #4)** is moot until then and is the natural follow-on.
- **Every drop is a discrete store action** (RoE multiplayer-insurance) — dragula handles the gesture, but the state change goes through `MOVE_STORY`, not direct mutation.
- **Within-sprint / within-backlog reorder** is facilitation theatre only (spec resolved decision 6): order never affects totals/capacity/warnings/exports.

## Deferred (candidate scope, in spec P0 order)

- **Drag-and-drop / placement** (P0 #3) — the natural Brief 3.
- **Capacity honesty banner** (P0 #4) — unlocks once placement exists.
- **Dependencies**: badges, tethers, cross-sprint connectors, the picker, violations (P0 #5). Note: the card editor's Dependencies section (Screen 2) was deliberately deferred here because its picker groups candidates by sprint *location*, which needs placement (DnD) first.
- **Exports** (P0 #6); **Resume/New-plan prompt** (Screen 3) — Brief 2 still restores the saved board silently on load; **JSON import/export** (P0 #7).

## Open housekeeping (logged, not yet actioned)

- Promote app-local theme bits to the shared foundation: `--plum`/`--plumwash`, `#glyph-plan`, and the 8 epic-palette colour tokens (currently in `plan.css`). Register `plan` as a SURFACE in the theme `manifest.mjs` + add the `check-theme-drift` test.
- **`storyCount` vs unplaced count** in the epic-row meta: `epicSummary.storyCount` is *total* stories; once DnD lands, the backlog panel shows only *unplaced* stories, so the row's "N stories" may want to become the unplaced count. Revisit in Brief 3.
- Sub-1280px backlog drawer still deferred (target viewport ≥ 1280px).

## Commands

```
npm install            # express + typescript (dev)
npm test               # node --test, 57 tests
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve on http://localhost:3004
```

---

## Suggested next brief

**Brief 3 = drag-and-drop placement (P0 #3).** Rationale: it is the keystone — it makes the backlog cards land in sprints, lights up the capacity pills (logic already built and tested), and is the prerequisite the deferred dependency picker is waiting on. Mostly: vendor dragula, add the `MOVE_STORY` action (pure, tested, conserving), render placed cards inside sprint containers, and wire dragula drops to dispatch. The store, the capacity maths, and the card visuals already exist. (Suggestion only — scope order is the director's call.)
