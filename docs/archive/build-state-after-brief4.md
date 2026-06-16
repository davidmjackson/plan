# Build state after Brief 4 — handoff for the next brief

**Purpose**: Ground the next brief in what the code *actually is* after Brief 4, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build; intended for the Claude app (Fable) when authoring Brief 5.
**As of**: `main` at `0fdbeb6` (PR #2 merged Brief 4). main now carries briefs 1–4; tree clean, 75 unit tests green, `tsc --noEmit` clean.
**Companions**: sprintplan-mvp-spec.md (v0.5), v1-screen-designs.md (v1.0), user-journeys.md (v1.0), aide-rules-of-engagement.md, build-log.md, build-state-after-brief1.md, build-state-after-brief2.md, build-state-after-brief3.md, housekeeping-dragula-vendoring.md.

---

## What Brief 4 shipped

The capacity **honesty banner** (P0 #4). Brief 3 lit the pills off neutral, so a sprint can now be genuinely over capacity; Brief 4 is the slim, non-blocking banner that renders inside an over-capacity sprint container, between the header and the body, names the overshoot in points ("Over committed by N pts. Relabelling it a stretch goal does not add capacity.", N in mono), and is **dismissible per sprint per session**. The pill stays the always-on signal; the banner is the one-time nudge.

Built TDD pure-first, browser-verified, director-signed-off, merged via merge-commit (per-brief SHAs preserved: feature `44f4f8a`, docs `20c449b`, merge `0fdbeb6`).

Verified: 75/75 unit tests (was 72 — three new in `plan-maths.test.js`); `tsc --noEmit` clean; headless Chromium confirmed the banner appears exactly as the pill leaves neutral, amber AND red, dismiss hides it for the session and leaves the pill untouched, a settings change re-arms it, a dismiss click never opens the card editor, and a drag never trips a dismiss — zero console errors.

---

## Architecture as built (the contract Brief 5 extends)

Everything from briefs 1–3 still holds (single store, pure reducer, serializable actions, capacity derived-not-stored, calendar dates as strings, ids minted in creators, deletes atomic, modal/view state out of the store, a move is remove-then-insert with every id conserved). **Brief 4 added NO store action and NO schema change** — it is a pure derived-view slice. Load-bearing facts:

- **The banner can never disagree with the pill, by construction.** Its visibility is *derived from* `pillState`, not a parallel threshold. `overBy(placed, capacity) = max(0, placed - capacity)` is the overshoot N **and** the visibility predicate, because `overBy > 0` is provably identical to `pillState(placed, capacity) !== "neutral"`. That identity is asserted exhaustively across the full (placed, capacity) grid in `plan-maths.test.js` — a drifting second threshold fails the unit net. A pill can never read amber/red with no banner, and a banner can never show on a neutral pill.
- **No new store action; the dismiss is view-local.** The reducer, the **15-action** vocabulary, and the state shape are all untouched, exactly as the pill colour (Brief 3) and the backlog collapse (Brief 2) added none. The dismissed set is a module-local `Set` in `banner.js`, mirroring `backlog.js`'s `collapsed` — never in the store, never autosaved. A reload is a new session that re-arms every still-over banner.
- **The pill carries the permanent signal; the banner is the closeable nudge.** Dismissing a banner never touches the pill (it stays amber/red with its number). A dismissed banner does **not** re-appear when more points are dragged into the same sprint mid-session — the pill already shouts the new total — which is what makes "dismiss per session" safe.
- **Regeneration clears dismissals; MOVE_STORY does not.** A settings change can re-shape sprints (change capacity, re-date, remove-then-re-add an index), opening a stale-index hole where a dismissal from a different plan shape could suppress a genuinely-over sprint. So the five settings handlers are wrapped by `dispatchSettings(action)` in `main.js`, which calls `clearDismissedBanners()` *before* dispatching. This is the **only** clear path; `MOVE_STORY` and every other action leave the set alone, preserving the per-session dismiss promise. View state never enters the store — the wrapper clears a view-local Set, it does not widen the store contract.
- **The dismiss click cannot trip edit-story.** The dismiss `×` is a sibling of the sprint body, not inside a placed card, so the board's delegated `closest("[data-act]")` listener routes it to `dismiss-banner`, never `edit-story`. It sits behind the same `isDragging()` swallow as the placed-card click. Verified in the browser.
- **The banner reuses the pill's washes, matched to state.** Amber-over → amber wash, red-over → red wash (`--amberwash` / `--redwash` / `--red`, already in `plan.css`). No new token, no plum (plum is the app accent and never means capacity, G4).

### Current state shape (UNCHANGED — still `schemaVersion: 1`)

```js
{
  meta:     { title, schemaVersion: 1 },
  settings: { startDate, durationMonths, sprintWeeks, velocity, bufferPct },
  sprints:  [ { index, name, startDate, endDate, days, isPartial, placedStoryIds: [] } ],
  backlog:  [ /* UNPLACED story ids; front = top (G3 "returned" slot) */ ],
  epics:    { [id]: { id, title, colourKey } },
  stories:  { [id]: { id, title, summary, points, epicId } },
  lastReturnedStoryIds: []
}
```

Brief 4 touched the shape not at all. **Brief 5 (dependencies) will be the first schema change since Brief 2** — see the next-brief notes.

### Action vocabulary — SHIPPED (15 actions, unchanged by Brief 4)

Settings/plan (Brief 1, 8); Cards (Brief 2, 6); Placement (Brief 3): `MOVE_STORY`.
Brief 4 added none.

**Not yet built:** `LINK_DEP` (dependencies, P0 #5).

### Pure functions available (all unit-tested, DOM-free)

- Brief 1: `date.js`, `plan-maths.js` (`sprintCapacity`, `pillState`, `adjustedCapacity`, …), `month-rail.js`, `regenerate.js`
- Brief 2: `validate.js`, `backlog-selectors.js` (`backlogGroups`, `epicSummary` → `{ unplacedCount, unplacedPoints }`), `epic-palette.js`
- Brief 3: `board-selectors.js` (`placedPoints(storyIds, stories)`, `sprintPlacedPoints(state, index)`)
- **Brief 4: `overBy(placed, capacity)` in `plan-maths.js`** — bare `max(0, placed - capacity)`, sitting beside `pillState` (the single threshold authority it consumes). Shipped bare, not paired with a combined `{ over, by }` helper — the render site already has `placed`/`capacity` and needs only the scalar, so a wrapper would be abstraction for its own sake.

### View modules

`dom.js`, `modal.js`, `backlog.js` (shared `storyCard` builder, `collapsed` Set), `card-editor.js`, `epic-editor.js`, `render.js`, `drag.js`, **`banner.js` (new — `dismissBanner`/`isBannerDismissed`/`clearDismissedBanners` over a module-local `dismissed` Set, and the `bannerEl(index, state2, by)` builder)**. `render.js` imports `overBy` + `bannerEl` + `isBannerDismissed` and appends the banner between sprint head and body when `overBy(placed, capacity) > 0 && !isBannerDismissed(index)`. `main.js` has the `dispatchSettings` wrapper and a `dismiss-banner` branch on the existing `#board` delegated click listener.

---

## What Brief 5 (dependencies, P0 #5) will need to touch

The natural follow-on, and **the heaviest slice so far**. Placement (Brief 3) unblocked it: the dependency picker groups candidate stories by their sprint *location*, which the board now provides. Likely scope — consider splitting (e.g. data + picker first, then connectors):

- **First schema change since Brief 2.** Dependencies are plan data and must persist. Expect a new field on stories (e.g. `dependsOn: string[]`) and very likely a `schemaVersion` bump with a migration path (the autosave restore reads whatever is in localStorage — an old saved plan must load). Propose the shape and the migration.
- **A new `LINK_DEP` action** (and its inverse / an unlink), the first action added since `MOVE_STORY`. Pure reducer, serializable, id-validated; reject self-links, unknown ids, and (if disallowed) cycles. Unit-test the reducer before any DOM.
- **The card editor's deferred Dependencies section + picker.** The picker lists candidate stories grouped by sprint location (unblocked by Brief 3). This is new editor surface, not just a board overlay.
- **Cross-sprint connectors — a genuinely new rendering concern.** SVG tethers/connectors between placed cards across sprint containers is the first drawing layer in the app (everything to date is DOM boxes). It interacts with the existing render/re-wire cycle and the drag gesture. This is the part most worth isolating into its own brief.
- **Violation borders.** A dependency pointing "backwards" (a story scheduled before something it depends on) is the violation the tool exists to surface — borders/markers on the offending cards, derived from a pure selector over placement + deps.

## Deferred (candidate scope, in spec P0 order)

- **Dependencies** (P0 #5) — suggested next; see above. The single largest slice; splitting is on the table.
- **Exports** (P0 #6) — the report's over-commitment list will **reuse `overBy`** (the banner is the in-board surfacing; the export is the document surfacing of the same figure).
- **JSON import/export + the Resume / New-plan prompt** (P0 #7) — flagged in brief4.md as the real data-loss gap (restore is still silent). Worth weighing *ahead of* #6: it is the genuine "lose your plan" exposure, not just a convenience.
- Stretch toggle (the natural companion to this banner), labels, parked lane, stats strip (P1).
- Sub-1280px backlog drawer; dark mode.

## Open housekeeping (logged, not yet actioned)

- **Dragula vendoring decision is now written** (`docs/housekeeping-dragula-vendoring.md`, raised by Brief 4): `plan` and `retrospective` each carry an identical vendored dragula. Recommendation recorded as **keep per-app copies**; a shared suite copy is a suite-level change against a second live app, **out of scope for any single feature brief** (touches both apps' `index.html` load paths + the suite's serving setup, outside this repo). Raise-only — no files moved.
- **Theme-token promotion still open** (carried, unactioned): promote `--plum`/`--plumwash`, `#glyph-plan`, and the 8 epic-palette tokens to the shared instrument-core source; register `plan` as a SURFACE in the theme `manifest.mjs` and add the `check-theme-drift` test. This is also suite-level.

## Branch / merge model (as now practised)

main is **no longer frozen** (it was, through Brief 3). Briefs 1–3 merged as PR #1 (`377f7b8`); Brief 4 merged as PR #2 (`0fdbeb6`). **Brief 5 branches off `main`** (no more stacking — stacking only existed while main was frozen). Merge with `gh pr merge --merge` (merge commit, NOT squash/rebase) so the build-log's per-brief SHA references stay valid. PR/merge is the director's call.

## Commands

```
npm test               # node --test tests/*.test.js, 75 tests
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve on http://localhost:3004
```

---

## Suggested next brief

**Brief 5 = dependencies (P0 #5).** Rationale: it is the next P0 and Brief 3's placement unblocked its picker (candidates group by sprint location). But it is the **heaviest slice to date** — the first schema change since Brief 2, the first new action since `MOVE_STORY`, new card-editor surface, the app's first SVG drawing layer (cross-sprint connectors), and violation borders. Strongly consider authoring it as **two briefs** (5a: deps data model + `LINK_DEP` + the editor picker + violation borders; 5b: the cross-sprint SVG connectors as their own rendering concern). One live alternative: re-sequence **P0 #7 (JSON import/export + resume prompt)** ahead, since silent-restore is the real data-loss exposure. (Suggestions only — scope order is the director's call.)
