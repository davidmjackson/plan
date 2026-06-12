# Build state after Brief 1 — handoff for the next brief

**Purpose**: Ground the next brief in what the code *actually is* after Brief 1, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build; intended for the Claude app (Fable) when authoring Brief 2.
**As of**: commit `f1ce219` on branch `brief-1-settings-capacity` (pushed to origin).
**Companions**: sprintplan-mvp-spec.md (v0.5), v1-screen-designs.md (v1.0), aide-rules-of-engagement.md, build-log.md.

---

## What Brief 1 shipped

The first vertical slice: a **settings strip** that drives **pure sprint generation**, rendering sprint containers with **derived capacity pills** and the **month rail**. No cards, no drag-and-drop, no exports, no backlog UI. Pills read `placed / capacity` with `placed` always 0 for now.

Verified: 40/40 unit tests assert the brief's worked cases verbatim; `tsc --noEmit` clean; headless Chromium reproduces the cases live (7 sprints / cap 18, Sprint 7 `0/12` partial; velocity 30 → `0/17`; 1-month → 3 sprints, Sprint 3 `0/5` partial) with zero console errors.

---

## Architecture as built (the contract the next brief extends)

**Single store, pure reducer, serializable actions.** `public/js/store.js` holds the only mutable state. Every change goes through `reduce(state, action)` (pure). The view dispatches named actions and never mutates state. Actions are plain `{ type, payload }` objects (serializable — this is the multiplayer-insurance seam). `createStore` adds `getState` / `dispatch` / `subscribe`.

**Capacity is never stored — always derived.** Sprints carry date facts only; capacity is computed on render from settings + sprint days. This is what makes "velocity/buffer change recomputes pills only" trivially true.

**Calendar dates are `YYYY-MM-DD` strings/integers, never JS `Date`.** All calendar math is pure string arithmetic in `date.js`. The single read of the system clock is isolated in `main.js` (`todayISO()` → `nextMonday()` for the default start).

**Days are counted INCLUSIVELY** (Sprint 7 = 9 days, not 8). This was derived from the brief's own worked numbers and is now load-bearing across `generateSprints`, proration and the month rail.

**`@ts-check` + JSDoc** on every `public/js` module; `npm run typecheck` (`tsc --noEmit`) is a clean gate. Tests are plain JS run by `node --test`.

### Current state shape (`createInitialState`)

```js
{
  meta:     { title: null, schemaVersion: 1 },
  settings: { startDate, durationMonths, sprintWeeks, velocity, bufferPct },
  sprints:  [ { index, name, startDate, endDate, days, isPartial, placedStoryIds: [] } ],
  backlog:  [],        // array of story ids; "top of backlog" = front of array
  epics:    {},        // id -> epic object  (SHAPE NOT YET DEFINED)
  stories:  {},        // id -> story object (SHAPE NOT YET DEFINED)
  lastReturnedStoryIds: []   // transient; drives the "returned to backlog" toast
}
```

> The data slots for cards (`epics`, `stories`, `backlog`, per-sprint `placedStoryIds`) **exist and are wired through regeneration**, but there is **no schema** for an epic or story object and **no actions** to create/move/edit them yet. That is the obvious next layer.

### Action vocabulary — SHIPPED (the complete current set)

`SET_START_DATE`, `SET_DURATION_MONTHS`, `SET_SPRINT_WEEKS`, `SET_VELOCITY`, `SET_BUFFER_PCT` (each runs G3 regeneration via `applySettings`), `SET_PLAN_TITLE`, `NEW_PLAN`, `LOAD_PLAN`.

**No card/epic/dependency actions exist yet** (e.g. `ADD_EPIC`, `ADD_STORY`, `MOVE_STORY`, `EDIT_STORY`, `DELETE_*`, `LINK_DEP`). They were *discussed* in the Brief 1 proposal but deliberately not stubbed — the next brief defines them for real.

### Pure functions available to build on (all unit-tested, DOM-free)

- `date.js` — `parseISO`, `toISO`, `daysInMonth`, `addDays`, `addMonths` (clamps overflow), `daysInclusive`, `isoWeekday`, `nextMonday`
- `plan-maths.js` — `adjustedCapacity(velocity, bufferPct)`, `proratedCapacity(adjusted, partialDays, fullDays)`, `sprintCapacity(sprint, settings)`, `pillState(placed, capacity)` → `"neutral"|"amber"|"red"`, `generateSprints(settings)`
- `month-rail.js` — `dominantMonth(start, end)`, `assignSprintsToMonths(sprints)`
- `regenerate.js` — `regenerate(prevState, nextSettings)` → `{ sprints, backlog, returnedStoryIds }`. Preserves placements by index; removed sprints' stories return to the **top** of the backlog; deletes nothing (story-conservation is invariant-tested).
- `store.js` — `createInitialState(startDate)`, `reduce(state, action)`, `createStore(initialState)`

### File layout

```
server.js                     minimal Express static host (no server logic in v1)
public/index.html             chrome + settings strip + #board grid + inline #glyph-plan
public/css/plan.css           plum accent + settings strip + pills + rail (extends instrument-core)
public/js/{date,plan-maths,month-rail,regenerate,store,actions}.js   pure logic + store
public/js/{render,main}.js    view layer (render composes pure fns; main wires + autosaves)
tests/*.test.js               node --test, 40 tests
tsconfig.json                 checkJs gate, scoped to public/js
```

---

## Deferred from Brief 1 (candidate scope for upcoming briefs)

- **Backlog panel + epic/story cards** (spec P0 #2): epic→story grouping, Fibonacci-chip + free-entry points (G5), card editor modal (Screen 2). **Prerequisite for almost everything below.**
- **Drag and drop** (P0 #3): dragula is already vendored elsewhere in the suite; every move must be a discrete store action.
- **Capacity warnings / honesty nudge** (P0 #4): pills already colour neutral/amber/red, but the over-commitment banner ("Relabelling it a stretch goal does not add capacity.") is not built.
- **Dependencies** (P0 #5): badges, tethers, cross-sprint connectors, violation state.
- **Exports** (P0 #6): markdown / printable HTML / CSV from one data template.
- **Resume / New-plan prompt** (Screen 3): Brief 1 restores the saved board **silently** on load. The no-silent-resume prompt and JSON import/export (P0 #7) are not built.

## Open housekeeping (logged, not yet actioned)

- Promote `#glyph-plan` and `--plum`/`--plumwash` from app-local (`index.html` inline symbol, `plan.css`) to the shared foundation (`/var/www/suite/shared/theme/glyphs.svg`, `instrument-core.css`).
- Register `plan` as a SURFACE in the theme `manifest.mjs` and add the `check-theme-drift` test step (other suite apps have it; plan does not yet).

## Commands

```
npm install            # express + typescript (dev)
npm test               # node --test, 40 tests
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve on http://localhost:3004
```

---

## Suggested next brief

**Brief 2 = the backlog panel and epic/story cards (P0 #2).** Rationale: it unblocks DnD (#3), makes the capacity pills meaningful once stories land in sprints (#4), and is presupposed by dependencies (#5) and exports (#6). The store already reserves `epics` / `stories` / `backlog` / `placedStoryIds` and regeneration already conserves them — so this brief is mostly *defining the epic/story object schema, the card actions, and the backlog/card-editor UI*, slotting into seams that already exist. (Suggestion only — scope order is the director's call.)
