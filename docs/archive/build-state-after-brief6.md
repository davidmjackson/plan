# Build state after Brief 6 — handoff for the next brief

**Purpose**: Ground the next brief in what the code *actually is* after Brief 6, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build; intended for the Claude app (Fable) when authoring Brief 7.
**As of**: `main` at `3be133d` (Brief 6 merged via PR #4 with `--merge`; per-brief SHAs `81b2462` feat / `3e650c6` docs preserved). Tree clean, **101 unit tests green**, `tsc --noEmit` clean.
**Companions**: sprintplan-mvp-spec.md (v0.5), v1-screen-designs.md (v1.0), user-journeys.md (v1.0), aide-rules-of-engagement.md, build-log.md, build-state-after-brief1.md…build-state-after-brief5.md, housekeeping-dragula-vendoring.md, brief6.md.

---

## What Brief 6 shipped

**Resume / New-plan prompt, Screen 3 (P0 #7, slice 2 of 2).** Brief 5 shipped autosave, the validated file half, and the `{ savedAt, plan }` envelope; Brief 6 spends that foundation to make restore *honest*. On opening with a saved board present, the app now shows the Resume / New-plan prompt instead of restoring silently (Journey 6: "no silent resume, so last quarter's plan never opens unannounced on a shared screen"). The dormant `NEW_PLAN` is activated as the app's one destructive path, shipping with its download-first escape hatch. The Brief 5 R5 clobber is closed: an unreadable save is surfaced with its reason and a raw-bytes rescue instead of being silently dropped.

**With Brief 6, P0 #7 (local persistence + file export/import) is COMPLETE.** Persistence and portability are done; the next heavy slice is Brief 7 (dependencies, P0 #5).

The load-bearing move (R2): **the store always boots fresh, and a saved board is restored only by an explicit, prompted `loadPlan` dispatch.** That single restructure ends silent restore, removes the last-quarter render leak (the board under the overlay is provably the fresh scaffold, not the saved plan), and — because a fresh boot never autosaves until the user acts — keeps the saved bytes intact under the prompt so an invalid save is rescuable instead of clobbered.

Built TDD pure-first, browser-verified, director-signed-off ("All Good").

Verified: 101/101 unit tests (was 91 — +10 across `tests/date.test.js` and `tests/board-selectors.test.js`); `tsc --noEmit` clean; 36 headless Chromium checks green, zero console errors (no-save boots fresh with no prompt and nothing autosaved; valid save shows the prompt with the saved title as heading while the board under the overlay stays fresh; Resume loads it; Escape resumes on valid; Start-new's download-first downloads the saved board, then the board is fresh, the save is overwritten, and a refresh shows the fresh board's own prompt; Import from the prompt loads a file and closes it; an invalid save shows the reason, no Resume, rescues the raw verbatim bytes, is not overwritten before the user acts, Escape is inert, and Start-new then overwrites).

---

## Architecture as built (the contract Brief 7 extends)

Everything from briefs 1–5 still holds (single store, pure reducer, serializable actions, capacity derived-not-stored, calendar dates as strings, ids minted in creators, deletes atomic, modal/view state out of the store, a move is remove-then-insert with every id conserved, the banner is a pure derived-view slice, `validatePlan` is the single load-path spine, `migratePlan` owns the version verdict over an empty `MIGRATORS` seam, the two-envelope leniency split). **Brief 6 added NO store action and NO schema change** — the prompt and its summary are persistence-/view-boundary concerns, outside the store. Load-bearing facts:

- **The store ALWAYS boots fresh (R2).** `createStore(freshPlan())` where `freshPlan()` = `createInitialState(nextMonday(todayISO()))`. A saved board is **never** substituted at boot. This is the safety pivot the whole brief turned on.
- **`classifySave()` replaces the old `loadOrInit()`.** It READS the stored bytes but SEEDS NOTHING, returning a discriminated verdict: `{ kind: "none" }` (first run); `{ kind: "valid", plan, savedAt }` (extract→migrate→validate all ok; `plan` already `normalise`d, lastReturnedStoryIds → []); `{ kind: "invalid", reason, raw }` (any pipeline failure OR a JSON parse error — `raw` is the verbatim stored string for rescue, `reason` is the plan-io reason or "the saved data isn't valid JSON"). Because it never writes, the bad bytes stay intact under the prompt — that is what makes the R5 rescue real.
- **Restore is a prompted dispatch.** After the fresh store paints, `classifySave()`'s verdict drives the load-time prompt: `valid`/`invalid` open it; `none` does nothing (and only then runs the first-run settings-strip highlight). Resume dispatches `loadPlan(verdict.plan)`; Start-new dispatches `newPlan(nextMonday(todayISO()))`; Import reuses the Brief 5 hidden-input pipeline. A successful load-time import closes the prompt (a module-level `activePrompt` handle; null mid-session).
- **`NEW_PLAN` is now ACTIVE and is the app's only destructive path.** It is dispatched exactly once, from the prompt's Start-new flow, only after the optional download-first escape hatch (which downloads the SAVED plan, the one about to be discarded). The dispatch autosaves the fresh plan immediately, so the discard is real and refresh-safe. No unguarded New-plan affordance exists anywhere (G8); there is no mid-session start-new control (R4 deferred it).
- **The prompt never writes state.** `resume-prompt.js` is a pure view over derived data; every side effect is a caller-supplied callback that dispatches an EXISTING action (`loadPlan`/`newPlan`) or runs the Brief 5 download/import glue. Export and both rescue/escape downloads READ; they never write state.
- **Escape semantics split by variant.** On the VALID prompt, Escape / overlay-click RESUMES (the safe non-destructive default). On the INVALID prompt it is INERT (nothing to resume; a stray Escape must never drop the rescuable bytes). This is why `modal.js` was NOT reused — its fixed Escape handler routes through a dirty-guard and always closes, with no way to express resume-vs-inert; the dedicated shell reuses only the `.modal-*` CSS.
- **`savedAt` is read for "Last edited".** The prompt reads `savedAt` off the `{ savedAt, plan }` restore envelope (written since Brief 5) and renders `relativeTime(savedAt, nowISO())`. A legacy bare save (no savedAt) shows "Last edited unknown" gracefully.
- **Doc/code drift recorded**: `extractPlan`'s upload mode is `"file"` in the shipped code (`extractPlan(parsed, "file" | "restore")`), though brief5.md/brief6.md prose call it `"import"`. The build matched the code. Trust the tree over the handoff prose.

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

Brief 6 touched the shape not at all. **Brief 7 (dependencies) will be the first schema change since Brief 2** — and the `migratePlan` seam (built in Brief 5, still empty) is exactly what makes that bump additive: add `MIGRATORS[1]` (v1→v2) and bump `CURRENT_SCHEMA`, not a retrofit.

### Action vocabulary — SHIPPED (15 actions, unchanged by Brief 6)

Settings/plan (Brief 1): `SET_START_DATE`, `SET_DURATION_MONTHS`, `SET_SPRINT_WEEKS`, `SET_VELOCITY`, `SET_BUFFER_PCT`, `SET_PLAN_TITLE`, `NEW_PLAN`, `LOAD_PLAN`. Cards (Brief 2): `ADD_EPIC`, `EDIT_EPIC`, `DELETE_EPIC`, `ADD_STORY`, `EDIT_STORY`, `DELETE_STORY`. Placement (Brief 3): `MOVE_STORY`. Brief 4 and Brief 5 added none.

**Brief 6 added no new action type.** It *activated* the dormant `NEW_PLAN` (creator `newPlan(startDate)`, reducer case `createInitialState(action.payload)`, built Brief 1) by dispatching it from the guarded Start-new flow. `LOAD_PLAN` (activated Brief 5 via validated import) gains a second caller: prompted Resume.
**Not yet built:** `LINK_DEP` (dependencies, Brief 7).

### Pure functions available (all unit-tested, DOM-free)

- Brief 1: `date.js`, `plan-maths.js` (`sprintCapacity`, `pillState`, `adjustedCapacity`, `generateSprints`, …), `month-rail.js`, `regenerate.js`
- Brief 2: `validate.js` (incl. `isValidPoints` — the single points authority), `backlog-selectors.js`, `epic-palette.js`
- Brief 3: `board-selectors.js` (`placedPoints`, `sprintPlacedPoints`)
- Brief 4: `overBy(placed, capacity)` in `plan-maths.js`
- Brief 5: `plan-io.js` — `validatePlan`, `migratePlan` (empty `MIGRATORS`, `CURRENT_SCHEMA = 1`), `exportPlan(state, exportedAt)`, `extractPlan(parsed, mode)`
- **Brief 6 (new)**:
  - `date.js` → **`relativeTime(fromISO, nowISO)`** — clock-free ("now" is an argument). Minutes/hours are ELAPSED time; yesterday and N-days are CALENDAR-day differences (reusing the module-private `toOrdinal`/`parseISO`), so a sub-24h save that crossed midnight reads "yesterday", not "3 hours ago". Buckets: `<60s` "just now"; `<60min` "N minutes ago"; `<24h && same calendar day` "N hours ago"; exactly 1 calendar day "yesterday"; 2–13 days "N days ago"; ≥14 days "on YYYY-MM-DD". Missing/invalid `fromISO` → "unknown", never throws.
  - `board-selectors.js` → **`planSummary(state)`** → `{ months, sprints, stories, placedPoints }`. `months` = `settings.durationMonths` (NOT the sprint count); `sprints` = `sprints.length`; `stories` = ALL stories; `placedPoints` = sum of `sprintPlacedPoints` (PLACED only, backlog excluded — reuses the points authority, no second sum).

### View / glue modules

`dom.js`, `modal.js`, `backlog.js`, `card-editor.js`, `epic-editor.js`, `render.js`, `drag.js`, `banner.js`, plus:
- **`resume-prompt.js` (new)** — `openResumePrompt(save, deps)` and `openInvalidPrompt(fail, deps)`. Dedicated shell (own keydown for the Escape split; reuses `.modal-*` CSS). Pure view over `planSummary`/`relativeTime`; deps are callbacks (`onResume`, `onStartNew`, `onImport`, `onDownloadCurrent`, `onDownloadRescue`). Browser-verified, not unit-tested (DOM glue, the same boundary Brief 3's drag gesture and Brief 5's Blob glue sit on).
- **`main.js` changes**: `loadOrInit` → `classifySave()` + `freshPlan()`; store seeded fresh always; the inline `#tb-export` body extracted into `downloadBoard(state)` / `downloadText(text, filename)` / `downloadRaw(text)` (R5 rescue, raw verbatim — NOT reserialised); `#tb-export` now calls `downloadBoard(store.getState())`; the load-time prompt wired after the file-I/O handlers; the first-run settings-strip highlight gated to `kind: "none"` only.
- **`plan.css` additions**: the `.rp-*` prompt styles — plum primary (`.rp-resume`) + `:focus-visible` rings, danger-ghost Start-new, mono summary/time, and a deliberately NEUTRAL invalid reason (amber/red are capacity colours and stay off the prompt). The prompt reuses `.modal-overlay` / `.modal-card`.

---

## Known limitations / notes carried into Brief 7

- **R5 clobber is CLOSED** (was the standing Brief 5 limitation). No open data-loss path remains in persistence.
- **Re-prompt after Start-new on an untouched fresh board is INTENDED** (not a bug to "fix" later): Start-new autosaves a fresh plan, so a subsequent refresh shows that fresh board's *own* prompt. This is the refresh-safe discard working as designed; the heading reads "Untitled plan", not last quarter's title.
- **`extractPlan` mode is `"file"` in code, `"import"` in the prose.** Use the code's name.

---

## What Brief 7 (Dependencies, P0 #5) will need to touch — the heaviest slice

The first schema change since Brief 2, and the app's first drawing layer. Candidate scope (the director sequences and may split):

- **Schema bump, additively.** Add `MIGRATORS[1]` (v1→v2) and bump `CURRENT_SCHEMA` in `plan-io.js`. The seam is built and empty; this is the intended use — not a retrofit. `validatePlan` will need to learn the new dependency field (structure + conservation: a dep references existing story ids; no self-dep; consider cycle rejection at the load boundary). Decide the field shape (e.g. `story.dependsOn: string[]`, or a top-level `deps` map) — this is a PROPOSE/ruling item.
- **`LINK_DEP` action** (the first new action since Brief 3) + creator + reducer case, ids/validation minted at the edge per the codebase rule.
- **Card-editor Dependencies section + picker** (grouped by sprint location, unblocked by Brief 3's placement). Reuses the modal shell.
- **The app's first SVG drawing layer** — cross-sprint connectors between dependent stories. New view module; browser-verified.
- **Violation borders** — a story placed before its dependency is a violation (a pure derived-view slice, like the banner; reuse the derived-not-stored discipline).

Strongly consider **splitting** (data + picker first, then the connector/violation visual layer) to hold one-feature-per-brief. brief7.md is **not yet authored**.

## Deferred (candidate scope, in spec P0 order)

- **Brief 7 — Dependencies** (P0 #5) — next; see above.
- **Exports** (P0 #6) — the report's over-commitment list reuses Brief 4's `overBy`. Separate brief, separate control (G8).
- Stretch toggle, labels, parked lane, stats strip (P1). Sub-1280px backlog drawer; dark mode.

## Open housekeeping (logged, not yet actioned)

- **Theme-token promotion still open** (carried): promote `--plum`/`--plumwash`, `#glyph-plan`, and the 8 epic-palette tokens to the shared instrument-core source; register `plan` as a SURFACE in the theme `manifest.mjs` and add the `check-theme-drift` test. Suite-level, out of scope for a feature brief.
- **Dragula vendoring decision stands** (`docs/housekeeping-dragula-vendoring.md`): keep per-app copies; a shared suite copy is a suite-level change against a second live app, out of scope for any single feature brief.

## Branch / merge model (as now practised)

main carries briefs 1–6 (`3be133d`). **Brief 6 merged via PR #4 with `gh pr merge --merge`** (merge commit, NOT squash/rebase) so the build-log's per-brief SHA references stay valid. It branched off `main` (no stacking). **Brief 7 branches off main.** Merged feature branches (`brief-5-board-file-io`, `brief-6-resume-prompt`, …) can be deleted when convenient.

## Commands

```
npm test               # node --test tests/*.test.js, 101 tests
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve on http://localhost:3004
```

Headless browser verification: no Playwright is installed in this repo; require it from a sibling (`/var/www/retrospective/node_modules/playwright`) in a CommonJS script. The localStorage state key is `sprintplan:board`; autosave fires on dispatch, not on init, so seed a save by nudging a real action (e.g. set the title) before reading storage.

---

## Suggested next brief

**Brief 7 = Dependencies (P0 #5).** Rationale: P0 #7 is complete, so the next P0 in spec order is dependencies — the heaviest remaining slice and the one the Brief 5 `migratePlan` seam was built to absorb. It is the first schema change since Brief 2, the first new action since Brief 3, and the first SVG layer in the app, so it is the strongest candidate for a two-brief split (data + picker, then connectors + violation borders). (Suggestion only — scope order is the director's call.)
