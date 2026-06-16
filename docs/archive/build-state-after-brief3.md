# Build state after Brief 3 — handoff for the next brief

**Purpose**: Ground the next brief in what the code *actually is* after Brief 3, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build; intended for the Claude app (Fable) when authoring Brief 4.
**As of**: branch `brief-2-backlog-cards` (Brief 3 built on top; carries briefs 1–3). Verified at the working tree described below.
**Companions**: sprintplan-mvp-spec.md (v0.5), v1-screen-designs.md (v1.0), user-journeys.md (v1.0), aide-rules-of-engagement.md, build-log.md, build-state-after-brief1.md, build-state-after-brief2.md.

---

## What Brief 3 shipped

Drag-and-drop placement — the keystone slice. A facilitator can drag backlog story cards into sprint containers, between sprints, reorder within a sprint, and drag them back to the backlog. Placed cards render inside the sprint body (epic colour dot, title, mono points chip — the same card visual as the backlog). **The capacity pill now reads the SUM OF POINTS of placed stories and moves off neutral for the first time** (neutral / amber / red via the existing `pillState`). The backlog panel now shows **unplaced stories only**; a placed story leaves the panel and its epic row meta tallies the unplaced count and points.

Verified: 72/72 unit tests; `tsc --noEmit` clean; headless Chromium drove a real drag end-to-end (backlog→sprint lands the card and removes it from the panel; pill reads "13 / 18" neutral then "21 / 18" red after a second drop — a count would have read 1 then 2; a drag does not open the editor while a click on a placed card does; backlog meta drops to "0 stories · 0 pts") with zero console errors.

---

## Architecture as built (the contract Brief 4 extends)

Everything from briefs 1 and 2 still holds (single store, pure reducer, serializable actions, capacity derived-not-stored, calendar dates as strings, ids minted in creators, deletes atomic, modal/view state out of the store). Brief 3 added **one action and two selectors, no new architecture**. Load-bearing facts:

- **A move is remove-then-insert, and every id is conserved.** `MOVE_STORY` removes the id from whichever array holds it (`removeIdFromArrays`) and inserts it into the target array before a given sibling. A story id is in exactly one array at all times — never two, never zero. Conservation is unit-tested (the id multiset across `backlog[]` + every `placedStoryIds[]` equals exactly the keys of `stories{}`).
- **A drag never changes a story's `epicId`.** Editor-only contract preserved. Enforced *structurally* at the view layer: the backlog is per-epic-group dragula containers and `accepts` refuses any card whose `epicId` differs from the target group's. `MOVE_STORY` itself never reads or writes the stories map.
- **Placed is POINTS, never count.** The pill is fed `sprintPlacedPoints(state, index)`, a pure selector summing the placed stories' points. `renderBoard` no longer uses `placedStoryIds.length`. Asserted case 1 fails the moment anyone feeds the pill a count again.
- **The store is the single source of truth; dragula owns the gesture only.** On drop the handler reads the intended move, reverts dragula's optimistic DOM mutation with `drake.cancel(true)`, and dispatches `MOVE_STORY`; the state-driven re-render then places the node. The view never mutates state. (The dispatch is deferred via `queueMicrotask` so the drop event unwinds before render rebuilds the DOM and re-creates the drake.)
- **Reorder is facilitation theatre.** Same-array `MOVE_STORY` (new position) changes order only; order never affects totals, capacity, pill state, or anything downstream.
- **Manual return ≠ system return.** A manual drag sprint→backlog lands at the pointed position, leaves `epicId` untouched, and does **not** set `lastReturnedStoryIds` (no toast). Only regeneration (a settings change that removes a sprint) returns stories to the front of `backlog[]` and fires the toast. The two paths are kept separate.

### Current state shape (unchanged from Brief 2)

```js
{
  meta:     { title, schemaVersion: 1 },
  settings: { startDate, durationMonths, sprintWeeks, velocity, bufferPct },
  sprints:  [ { index, name, startDate, endDate, days, isPartial, placedStoryIds: [/* now populated by drags */] } ],
  backlog:  [ /* UNPLACED story ids; front = top (G3 "returned" slot) */ ],
  epics:    { [id]: { id, title, colourKey } },
  stories:  { [id]: { id, title, summary, points, epicId } },
  lastReturnedStoryIds: []
}
```

No shape change — Brief 3 only started *using* `placedStoryIds`. Autosave persists placements for free (every drop is an action); a refresh keeps the board.

### Action vocabulary — SHIPPED (15 actions)

Settings/plan (Brief 1, 8); Cards (Brief 2, 6); **Placement (Brief 3): `MOVE_STORY`**.
Payload: `{ storyId, target: { kind: "backlog" } | { kind: "sprint", index }, beforeId: string | null }`. `beforeId` is the drop sibling's story id (null = append) — chosen over a numeric index to avoid the remove-then-insert off-by-one on same-array reorder. Invalid moves (unknown id, out-of-range sprint index) return state unchanged.

**Not yet built:** `LINK_DEP` (dependencies, P0 #5).

### Pure functions available (all unit-tested, DOM-free)

- Brief 1: `date.js`, `plan-maths.js` (`sprintCapacity`, `pillState`, …), `month-rail.js`, `regenerate.js`
- Brief 2: `validate.js`, `backlog-selectors.js` (`backlogGroups`, `epicSummary` — now returns `{ unplacedCount, unplacedPoints }`), `epic-palette.js`
- **Brief 3: `board-selectors.js` (`placedPoints(storyIds, stories)`, `sprintPlacedPoints(state, index)`)**

### View modules

`dom.js`, `modal.js`, `backlog.js` (now exports the shared `storyCard(story, epic?)` builder and `NO_EPIC` sentinel; renders each epic group's body as a `data-drop="backlog"` container), `card-editor.js`, `epic-editor.js`, `render.js` (renders placed cards in sprint bodies, `data-drop="sprint"`), **`drag.js` (new — `setupDrag(store)` re-wires dragula after every render; `isDragging()` gates click-to-edit)**. `main.js` now `paint()`s (render + re-wire drag) on every change and has a second delegated click listener on `#board` for placed cards. dragula is vendored at `plan/public/vendor/dragula/` and loaded as a global `<script>` before the modules in `index.html`.

---

## What Brief 4 (capacity honesty banner, P0 #4) will need to touch

The natural follow-on: placement now produces real over-committed sprints, so the honesty banner finally has something to warn about. Likely scope:

- **The banner itself** — Screen 1 honesty banner text + the over-committed nudge, with dismiss-per-session (view state, not store, per the modal-state precedent). The amber/red **thresholds** and pill colours already exist (`pillState`); Brief 4 adds the *banner*, which the pill colour does not yet imply.
- **No new store action is obviously required** — the banner is derived view data over existing state (sum placed points vs capacity per sprint, already available via `sprintPlacedPoints` + `sprintCapacity`). If a "dismissed" set is needed it is view-local, like backlog collapse.
- Watch the precedent: dismiss-per-session must survive re-render without entering the store (mirror `backlog.js`'s module-local `collapsed` set).

## Deferred (candidate scope, in spec P0 order)

- **Capacity honesty banner** (P0 #4) — the natural Brief 4 (placement now makes it meaningful).
- **Dependencies**: badges, tethers, cross-sprint connectors, the picker, violation borders (P0 #5). The card editor's Dependencies section is still deferred; its picker groups candidates by sprint *location*, which Brief 3 now provides — so it is unblocked.
- **Exports** (P0 #6); **Resume/New-plan prompt** (Screen 3, still silent restore); **JSON import/export** (P0 #7).
- Stretch toggle, labels, parked lane, stats strip (P1).
- Sub-1280px backlog drawer (deferred; target viewport ≥ 1280px).

## Open housekeeping (logged, not yet actioned)

- Promote app-local theme bits to the shared foundation: `--plum`/`--plumwash`, `#glyph-plan`, the 8 epic-palette tokens (in `plan.css`). Register `plan` as a SURFACE in the theme `manifest.mjs` + add the `check-theme-drift` test.
- **Vendored dragula is now a second copy** of the suite's (`retrospective/public/vendor/dragula/`). A suite ticket should decide whether `plan` and `retrospective` share one vendored copy rather than each carrying their own.
- The `storyCount`-vs-unplaced flag from Brief 2 is **closed** (`epicSummary` now returns `unplacedCount`).

## Commands

```
npm test               # node --test, 72 tests
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve on http://localhost:3004
```

---

## Suggested next brief

**Brief 4 = capacity honesty banner (P0 #4).** Rationale: Brief 3 lit the pills off neutral, so for the first time a sprint can be genuinely over-committed — the banner is the honest surfacing of that, and the thresholds/colours already exist. It is a small, derived-view slice (likely no new store action), and the dismiss-per-session pattern has a clean precedent in the backlog-collapse view state. (Suggestion only — scope order is the director's call.)
