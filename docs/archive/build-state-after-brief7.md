# Build state after Brief 7 — handoff for the next brief

**Purpose**: Ground the next brief in what the code *actually is* after Brief 7 slice 1, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build; intended for the Claude app (Fable) when authoring Brief 8 (dependencies slice 2 — the board drawing layer).
**As of**: branch `brief-7-dependencies-data` (commits `eff9213` feat / `e52ec23` docs / `8805f01` sign-off), **PR #5 open against `main`, merge pending the director**. Tree clean, **124 unit tests green**, `tsc --noEmit` clean. (Brief 8 branches off `main` *after* PR #5 merges — see Branch / merge model.)
**Companions**: sprintplan-mvp-spec.md (v0.5), v1-screen-designs.md (v1.0), user-journeys.md (v1.0), aide-rules-of-engagement.md, build-log.md, build-state-after-brief1.md…build-state-after-brief6.md, housekeeping-dragula-vendoring.md, brief7.md.

---

## What Brief 7 slice 1 shipped

**Dependencies — data, picker, badge (P0 #5, slice 1 of 2).** The heaviest remaining P0, split data-vs-drawing per the brief. This slice shipped the **model** (first schema bump since Brief 2, v1→v2, through the empty Brief 5 migrator seam), the **card-editor Dependencies section + inline picker**, the **neutral shared D badge** on board and backlog cards, and the **violation feedback inside the editor row at creation time** (Screen 2). It draws **no SVG and adds no board-side red** — that is slice 2.

A dependency is **one directed pair**, creatable from either side: `blockerId` is the prerequisite (do first), `blockedId` is the dependent (blocked). "This needs…" and "This blocks…" write the *same* pair; they only choose which slot the current story takes. A **violation** is a scheduling mistake — the blocked story is placed in an earlier sprint than its blocker — and per G7 it evaluates only when BOTH stories are scheduled; backlog either side is neutral.

The load-bearing call was the **field shape**: a top-level `deps: [{ id, blockerId, blockedId }]` array, each pair a first-class entity with its own id. That makes the shared **D badge** identity (D1 on *both* endpoints) fall out by construction, keeps either-side creation to one stored direction, makes 1-to-many just "many pairs with the same `blockerId`", and reduces delete-pruning to a single `filter`.

Built TDD pure-first, browser-verified, director-signed-off ("All Good").

Verified: 124/124 unit tests (was 101 — +23 across `tests/dep-selectors.test.js`, `tests/store-deps.test.js`, and new cases in `tests/plan-io.test.js`); `tsc --noEmit` clean; **26 headless Chromium checks, zero console errors** (section + buttons render; picker excludes self then also the already-paired story and groups by location; selecting creates the pair, assigns D1, closes the picker, the row appears; neutral D1 badge on both board and backlog cards; a "needs" pair where the dependent sits earlier renders the editor row red annotated "Sprint 2, after this" with no board-side red; remove drops the pair and both badges; deleting a paired story prunes the pair with `deps` empty and no dangling id; a duration shrink that returns a placed dependent to the backlog keeps the pair, badge persists, violation clears; a pre-Brief-7 v1 save is offered for resume and migrates to v2 with `deps: []`).

---

## Architecture as built (the contract Brief 8 extends)

Everything from briefs 1–6 still holds (single store, pure reducer, serializable actions, capacity derived-not-stored, calendar dates as strings, ids minted in creators, deletes atomic, modal/view state out of the store, a move is remove-then-insert with every id conserved, `validatePlan` the single load-path spine, `migratePlan` owns the version verdict, the store always boots fresh and restore is a prompted dispatch). Brief 7 slice 1 made the **first state-shape change since Brief 2** and added **two actions**. Load-bearing facts:

- **`deps` is a top-level array of directed pairs.** `{ id, blockerId, blockedId }` — `blockerId` = prerequisite/do-first, `blockedId` = dependent. The pair id is minted in the `linkDep` creator (`newId("dep")`), never in the reducer. The pair stores **story ids only** — never card positions or sprint indexes — so it survives every `MOVE_STORY` and every settings regeneration untouched (R9, resolved decision 6).
- **The schema is now v2, bumped additively through the seam.** `CURRENT_SCHEMA = 2`; `MIGRATORS[1] = (plan) => ({ ...plan, deps: [], meta: { ...plan.meta, schemaVersion: 2 } })` (additive, never deletes). `createInitialState` seeds `deps: []` + `schemaVersion: 2`. `exportPlan` stamps `schemaVersion` from `state.meta`, so once the store is v2 every save and file is v2. A v1 autosave or a v1 file flows through `migratePlan` and gains the empty field with no data loss. The newer-version guard now fires at **v3** (not v2).
- **`validatePlan` learns the field at the load boundary.** It requires `deps` is an array and each pair links **two distinct existing stories** with **no duplicate pair**, naming the first failure in the house style: `missing or invalid key: deps`; `dependency "<id>" links a story to itself`; `dependency "<id>" references unknown story "<id>"`; `duplicate dependency between "<a>" and "<b>"`. A dangling pair id is **the one unforgivable load-boundary failure**, rejected here.
- **Deletes prune pairs atomically (R7, the zero-data-loss line).** `deleteStory` filters `state.deps` to drop any pair referencing the removed id, in the same reducer step; `deleteEpic("delete")` drops every pair referencing a removed child id. `reparent` mode needs no change (stories survive). After any delete `validatePlan` would pass — no delete, move, or settings change can leave a dangling pair.
- **The D number is DERIVED, not stored.** `depLabel(state, dep)` = `"D" + (state.deps.indexOf(dep) + 1)`, recomputed on render; removing a pair renumbers the rest. The badge is a within-session visual aid, not a stable external reference. (If a stable per-pair number is ever wanted, that is a deliberate change, not a bug.)
- **The card editor commits dependencies LIVE; the form fields still commit on Save.** A link is a fact about two existing stories, not a pending field edit, so the Dependencies section dispatches `LINK_DEP`/`UNLINK_DEP` immediately and re-renders itself in place (the board/backlog re-render from their own store subscription). Dependency edits do **not** mark the form dirty. The section shows **only for a saved story** — a new, unsaved story has no id to link.
- **The violation selector is wired only to the editor row this slice.** `isViolation` is clock-free and pure; the editor row takes the existing danger/red treatment with the other side's location annotated ("Sprint 2, before this" / "after this", computed from the two sprint indices so it reads correctly from either endpoint). **No board-side red exists yet** — that is slice 2. This is the only red in slice 1; the neutral badge and picker carry no capacity colours (amber/red mean capacity only).

### Current state shape (CHANGED — now `schemaVersion: 2`, new `deps`)

```js
{
  meta:     { title, schemaVersion: 2 },          // was 1
  settings: { startDate, durationMonths, sprintWeeks, velocity, bufferPct },
  sprints:  [ { index, name, startDate, endDate, days, isPartial, placedStoryIds: [] } ],
  backlog:  [ /* UNPLACED story ids; front = top (G3 "returned" slot) */ ],
  epics:    { [id]: { id, title, colourKey } },
  stories:  { [id]: { id, title, summary, points, epicId } },
  deps:     [ { id, blockerId, blockedId } ],     // NEW (Brief 7); blockerId = do-first, blockedId = dependent
  lastReturnedStoryIds: []
}
```

Story records are unchanged — the relationship lives in `deps`, not on the story (chosen over `story.dependsOn` precisely so the shared D-number identity is first-class). **Brief 8 makes NO schema change**: it is a pure view over this model.

### Action vocabulary — SHIPPED (17 actions)

Settings/plan (Brief 1): `SET_START_DATE`, `SET_DURATION_MONTHS`, `SET_SPRINT_WEEKS`, `SET_VELOCITY`, `SET_BUFFER_PCT`, `SET_PLAN_TITLE`, `NEW_PLAN`, `LOAD_PLAN`. Cards (Brief 2): `ADD_EPIC`, `EDIT_EPIC`, `DELETE_EPIC`, `ADD_STORY`, `EDIT_STORY`, `DELETE_STORY`. Placement (Brief 3): `MOVE_STORY`. **Dependencies (Brief 7): `LINK_DEP`, `UNLINK_DEP`.**

- `linkDep({ blockerId, blockedId })` → `{ type, payload: { id: newId("dep"), blockerId, blockedId } }`; reducer appends the pair. `unlinkDep({ id })`; reducer filters by id. Both reducer cases are trivial — the picker is the creation gate and `validatePlan` the load backstop, so they trust validated payloads (consistent with the rest of the app).
- **Brief 8 adds no new action and no schema change** — the connectors/tethers/board-red are a pure derived view over `deps` + `isViolation`.

### Pure functions available (all unit-tested, DOM-free)

- Brief 1: `date.js` (incl. `relativeTime` from Brief 6), `plan-maths.js`, `month-rail.js`, `regenerate.js`
- Brief 2: `validate.js` (incl. `isValidPoints`), `backlog-selectors.js`, `epic-palette.js`
- Brief 3/4: `board-selectors.js` (`placedPoints`, `sprintPlacedPoints`, `planSummary`), `overBy` in `plan-maths.js`
- Brief 5: `plan-io.js` — `validatePlan` (now learns `deps`), `migratePlan` (**`CURRENT_SCHEMA = 2`, `MIGRATORS[1]` populated**), `exportPlan`, `extractPlan`
- **Brief 7 (new) — `dep-selectors.js`** (DOM-free, the module Brief 8 consumes):
  - `storyLocation(state, storyId)` → `{ kind: "sprint", index } | { kind: "backlog" } | null` (null for unknown; pure, no throw). Drives picker grouping, the editor-row location label, and the violation check.
  - `locationLabel(state, location)` → the sprint's own `name`, or `"Backlog"`, or `null`.
  - `depRole(dep, storyId)` → `"blocks"` (storyId is the blocker) | `"needs"` (storyId is the blocked) | `null`.
  - `depLabel(state, dep)` → the shared badge string `"D" + (index + 1)` (derived).
  - **`isViolation(state, dep)`** → `true` only when BOTH endpoints are in sprints AND the blocked story's sprint index is strictly less than the blocker's (R4/G7). Backlog either side, same sprint, or correct order all `false`. **Slice 2's board-side red consumes this directly.**
  - `depsForStory(state, storyId)` → editor rows: `{ dep, label, role, otherId, otherTitle, otherLocation, violation }` per touching pair, in deps order.
  - **`depBadges(state, storyId)`** → card badges: `{ label, violation }` per touching pair. Slice 1 renders `label` only (neutral); **the `violation` flag is already carried on every badge for slice 2.**
  - `pickableDepTargets(state, storyId)` → `{ id, title, location }[]` — every other story not self, not already paired (R3/R4; backlog stories included).

### View / glue modules

`dom.js`, `modal.js`, `backlog.js`, `card-editor.js`, `epic-editor.js`, `render.js`, `drag.js`, `banner.js`, `resume-prompt.js`, plus the Brief 7 changes:
- **`card-editor.js`** — gained a `buildDependencies(store, storyId)` module function appended below the existing editor, mounted under Summary only when editing a saved story. It renders existing links as rows (shared badge, "needs"/"blocks", paired title, paired location in mono, danger-ghost remove), a violating row in the red treatment with the location annotated, "This blocks…" / "This needs…" buttons, and an **inline expanding picker** (search input + `pickableDepTargets` grouped by sprint then Backlog via a `groupByLocation` helper; selecting dispatches `linkDep` with the current story on the chosen side and collapses the panel). Inline (not a nested modal) keeps one modal at a time and avoids nested-Escape juggling. Browser-verified, not unit-tested (the same DOM boundary Brief 3's drag and Brief 6's prompt sit on).
- **`backlog.js` `storyCard(story, epic, badges = [])`** — gained an optional **third `badges` param** (least invasive). Renders the neutral D badges after the points chip. Both callers pass `depBadges(state, story.id)`: `backlog.js` (`storyCard(story, null, …)`) and `render.js` board cards (`storyCard(story, epic, …)`).
- **`plan.css` additions** — `.dep-badge` (plum/ink, neutral), the `.deps-section` / `.deps-rows` / `.dep-row` rows, `.dep-row--violation` (the only red this slice; `--red`/`--redwash`), and the `.dep-picker` / `.dep-search` / `.dep-group-head` / `.dep-option` picker with plum `:focus-visible` rings. No capacity colours on the badge or picker.

---

## Known limitations / notes carried into Brief 8

- **Cycle detection is deferred (by ruling).** Self-dep and identical-pair are rejected at the picker (exclusion) and the load boundary (`validatePlan`). Note the load-boundary duplicate check is **directional** (keyed `blockerId>blockedId`): a *reverse* pair (A needs B and B needs A) is not a duplicate and passes validation by construction. The picker's exclude-already-paired rule is what prevents creating one through the UI. A true cycle is therefore never graph-detected: it simply produces mutual violation flags when both are scheduled, which is honest and never causes a real failure. If a cycle is ever ruled to need rejection, that is a defined addition to `validatePlan` + the picker, not a "while we're here".
- **The D number renumbers on removal** (derived, intended). A within-session aid, not a stable reference.
- **No board-side dependency visual exists yet** — no SVG, no connectors, no tethers, no board-side red. That is the whole of slice 2.
- **Doc/code naming note still stands** (from Brief 6): `extractPlan`'s upload mode is `"file"` in code.
- **`validatePlan` does not shape-guard each `deps` element (logged, not fixed in slice 1).** The pair loop reads `d.blockerId`/`d.blockedId` without first confirming `d` is an object, so a malformed import such as `deps: [null]` throws at the load boundary instead of returning a clean `{ ok: false, reason }` in the house style. The picker cannot produce this and our own saves never will — only a hand-edited or corrupted file reaches it — so it is recorded here rather than patched in the data slice. The natural home for the one-line object guard is the Exports brief (P0 #6), which already touches the I/O surface; until then, do not assume `deps` elements are pre-shape-checked downstream.

---

## What Brief 8 (Dependencies slice 2, P0 #5) will need to touch — the board drawing layer

The app's **first SVG layer**, drawn on the board as a pure view over the slice 1 model. **No new action, no schema change.** Candidate scope (the director sequences):

- **Cross-sprint connectors** between dependent stories, on hover/select (Journey 4: arrows render on the board, but the link is created/removed in the card editor only — slice 1 already enforces that).
- **The always-visible same-sprint tether** for a pair whose endpoints share a sprint.
- **Board-side RED violation treatment** on cards and connectors when `isViolation(state, dep)` is true — consuming the flag `depBadges` already carries on every badge.
- A new view module (e.g. `connectors.js`), browser-verified, drawn over the existing board DOM; reuse `storyLocation` to find each endpoint's column/row and `isViolation` for the red. The card DOM already exposes `data-story` on every card for hit-testing/positioning.

Everything slice 2 needs is ready-made: **the `deps` model, `isViolation`, `depBadges` (with the violation flag carried), `storyLocation`, and the neutral badge.** Slice 2 is purely the SVG + board-side red.

## Deferred (candidate scope, in spec P0 order)

- **Brief 8 — Dependencies slice 2** (P0 #5) — next; see above.
- **Exports** (P0 #6) — the report's over-commitment list reuses Brief 4's `overBy`; it also consumes the slice 1 `isViolation` for the dependency-violation warnings. Separate brief, separate control (G8).
- Stretch toggle, labels, parked lane, stats strip (P1). Sub-1280px backlog drawer; dark mode. A persistent/mid-session New-plan control (Brief 6 R4 deferred it); multiple boards (P2).

## Open housekeeping (logged, not yet actioned)

- **Theme-token promotion still open** (carried): promote `--plum`/`--plumwash`, `#glyph-plan`, and the 8 epic-palette tokens to the shared instrument-core source; register `plan` as a SURFACE in the theme `manifest.mjs` and add the `check-theme-drift` test. Suite-level, out of scope for a feature brief.
- **Dragula vendoring decision stands** (`docs/housekeeping-dragula-vendoring.md`): keep per-app copies; a shared suite copy is a suite-level change against a second live app, out of scope for any single feature brief.

## Branch / merge model (as now practised)

main carries briefs 1–6. **Brief 7 slice 1 is on `brief-7-dependencies-data`, PR #5 open against main, merge pending the director** (per cadence: `gh pr merge --merge` — merge commit, NOT squash/rebase — so the build-log's per-brief SHA references stay valid). It branched off `main` (no stacking). **Brief 8 branches off `main` after PR #5 merges.** Merged feature branches can be pruned when convenient.

## Commands

```
npm test               # node --test tests/*.test.js, 124 tests
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve on http://localhost:3004
```

Headless browser verification: no Playwright is installed in this repo; require it from a sibling (`/var/www/retrospective/node_modules/playwright`) in a CommonJS script. The localStorage state key is `sprintplan:board` (a `{ savedAt, plan }` envelope — unwrap `.plan`); autosave fires on dispatch, not on init. To seed real state for a browser test, build it in-page via dynamic `import("./js/store.js")` + the real reducers, inject the envelope, and reload through the resume prompt (this also exercises the migrate path); a valid save raises the Brief 6 prompt, so click `.rp-resume` before driving the board.

---

## Suggested next brief

**Brief 8 = Dependencies slice 2 (P0 #5).** Rationale: slice 1 shipped the model and the editor; the natural next cut is the board drawing layer it was split away from — the app's first SVG, a pure view over `deps` + `isViolation` with no new action and no schema change. The violation flag is already threaded through `depBadges`, and `storyLocation` already resolves each endpoint, so slice 2 is a clean, self-contained visual brief. (Suggestion only — scope order is the director's call.)
