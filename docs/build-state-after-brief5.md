# Build state after Brief 5 — handoff for the next brief

**Purpose**: Ground the next brief in what the code *actually is* after Brief 5, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build; intended for the Claude app (Fable) when authoring Brief 6.
**As of**: branch `brief-5-board-file-io` at `2d99f3a` (feature `9f7c352`, docs `2d99f3a`), pushed to origin; **PR not yet opened — director's call**. main is still at `0fdbeb6` (briefs 1–4). Tree clean, 91 unit tests green, `tsc --noEmit` clean.
**Companions**: sprintplan-mvp-spec.md (v0.5), v1-screen-designs.md (v1.0), user-journeys.md (v1.0), aide-rules-of-engagement.md, build-log.md, build-state-after-brief1.md…build-state-after-brief4.md, housekeeping-dragula-vendoring.md, brief5.md.

---

## What Brief 5 shipped

**Board file export/import + load-path validation (P0 #7, slice 1 of 2).** The autosave half of P0 #7 already worked (every action persists; refresh loses nothing); Brief 5 adds the explicit file half *and* the validation the existing load paths skipped. A facilitator can now download the current board as a self-identifying `.json` and import one back, with a bad or foreign file refused cleanly and the current board never harmed. The safety core (validate + migrate + export + extract) is pure and unit-tested first; the file plumbing and the top-bar control are thin glue over it.

The finding that drove the brief: **two unvalidated load paths**, both confirmed in the live source. `LOAD_PLAN` returned `action.payload` verbatim (zero validation), and `loadOrInit` returned `JSON.parse(localStorage)` straight as state with only a parse-error catch — so a structurally-invalid-but-parseable object loaded and crashed the renderer. The fix is a single pure `validatePlan` that **every** load path now passes through, plus an **atomic** import (validate before touching the board).

Built TDD pure-first, browser-verified, director-signed-off. **This brief is slice 1 of 2**: Brief 6 is the Resume / New-plan prompt (Screen 3) that ends silent restore and reuses everything built here.

Verified: 91/91 unit tests (was 75 — +16 in `tests/plan-io.test.js` covering all 12 asserted cases); `tsc --noEmit` clean; 15 headless Chromium checks green, zero console errors (both G8 buttons visible, file input hidden; envelope written and `savedAt` not in state; legacy bare save still restores; export self-identifying with `lastReturnedStoryIds` reset; foreign file rejected and board byte-identical after; scratched board re-imports to identical; plum focus ring confirmed by screenshot).

---

## Architecture as built (the contract Brief 6 extends)

Everything from briefs 1–4 still holds (single store, pure reducer, serializable actions, capacity derived-not-stored, calendar dates as strings, ids minted in creators, deletes atomic, modal/view state out of the store, a move is remove-then-insert with every id conserved, the banner is a pure derived-view slice). **Brief 5 added NO store action and NO schema change** — the envelopes and validation are persistence-*boundary* concerns, outside the store. Load-bearing facts:

- **`validatePlan` is the single spine every load path passes through.** It lives at the boundary (R1): the import handler and `loadOrInit` both run it *before* any dispatch, and `LOAD_PLAN`'s reducer case stays trivial (`return action.payload`) — it is only ever handed an already-validated state. The reducer was **not** hardened; validation is at the edge, matching the codebase rule (ids minted in creators, validation at the edge).
- **The conservation invariant `MOVE_STORY` guards in memory is now enforced on every load.** `validatePlan` checks required keys + kinds; that every backlog/placed id exists in `stories`; that no id appears in two arrays (dangling **and** duplicate both fail); that every `story.epicId` is null-or-existing; and that every story's points pass the points rule. The `reason` string names the first failure and surfaces in the import error.
- **One points authority, no second threshold.** `validate.js` gained `isValidPoints(n)` as the **sole** positive-integer points predicate; `parsePoints` was refactored to consume it, and `validatePlan` reuses the same predicate. A future drift between two points rules fails the unit net — the same anti-dishonesty discipline Brief 4 applied to `overBy` vs `pillState`.
- **`migratePlan` owns the schema-version verdict; the seam is built but empty.** It dispatches on `schemaVersion`: a missing/invalid version or one **newer** than this build fails clearly ("saved by a newer version of sprintplan"); v1 passes. The seam is a version-loop over an empty `MIGRATORS` map with `CURRENT_SCHEMA = 1` (plan-io.js:84,89). **Brief 7 (dependencies) adds `MIGRATORS[1]` (v1→v2) and bumps `CURRENT_SCHEMA`, additively — not a retrofit.** `validatePlan` checks structure/conservation only; the version verdict is `migratePlan`'s alone (the clean split of the two flagged ⚑).
- **Two envelopes, one inner plan, leniency split by who wrote the bytes.** The exported FILE is `{ app: "sprintplan", schemaVersion, exportedAt, plan }` (R2); the localStorage SAVE is `{ savedAt, plan }` (R7). Both wrap the same inner plan, and `validatePlan` validates only that inner plan. A single `extractPlan(parsed, mode)` unwraps either form with **different leniency**: `"import"` (uploaded file) is **strict** — require `app === "sprintplan"` or it is refused as foreign; `"restore"` (our own bytes) is **lenient** — accept the envelope OR a legacy bare state object. This split is the load-bearing safety call: strict where the user supplied the bytes, lenient where we did. Tolerating a legacy bare save is itself a no-data-loss decision (discarding a valid pre-Brief-5 board would be the loss we are here to prevent).
- **Import is atomic (R3).** The `tb-import` handler reads → `extractPlan("import")` → `migratePlan` → `validatePlan`; only on success does it dispatch `loadPlan(normalise(plan))` (which autosaves + repaints for free). On any failure it shows a clear, non-blocking error and leaves the board exactly as it was. Verified in the browser.
- **`lastReturnedStoryIds` normalises to `[]` on every load (R6).** It is transient toast-trigger state, meaningless across a load/import boundary. `exportPlan` resets it in the emitted plan; `normalise(plan)` in main.js resets it before any loaded/imported/restored state becomes the store, so no stale "returned to backlog" toast fires on load.
- **`savedAt`/`exportedAt` are boundary clock reads, never in state.** `nowISO()` (main.js:47) is a second boundary clock read alongside `todayISO()`. `savedAt` is stamped in the autosave subscriber at serialize time; `exportedAt` is passed into the pure `exportPlan(state, exportedAt)` by the caller. Neither ever enters store state or passes through an action — the reducer stays a pure function of `(state, action)` with no time dependency.
- **The loader now validates the restore; full recovery is Brief 6 (R5).** `loadOrInit` runs the same pipeline on the restored value and, on structural invalidity, falls back to a fresh plan exactly as it already did on a parse error. See the known limitation below.

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

Brief 5 touched the shape not at all. The persistence envelopes (`{ savedAt, plan }` in localStorage; `{ app, schemaVersion, exportedAt, plan }` in the file) wrap this state but are **not** part of it. **Brief 7 (dependencies) will be the first schema change since Brief 2** — and the `migratePlan` seam built here is exactly what makes that bump additive.

### Action vocabulary — SHIPPED (15 actions, unchanged by Brief 5)

Settings/plan (Brief 1, 8); Cards (Brief 2, 6); Placement (Brief 3): `MOVE_STORY`. Brief 4 added none.
**Brief 5 added no new action type.** It *activated* the dormant `LOAD_PLAN` (built Brief 1) by wiring it to a validated import.

**Still dormant:** `NEW_PLAN` (creator `newPlan(startDate)`, a real reducer case, never dispatched). It stays dormant deliberately — a bare New-plan button is an unguarded data-loss path; the destructive start-new flow needs its download-first escape hatch, which lives in the **Brief 6** resume prompt.
**Not yet built:** `LINK_DEP` (dependencies, now Brief 7).

### Pure functions available (all unit-tested, DOM-free)

- Brief 1: `date.js`, `plan-maths.js` (`sprintCapacity`, `pillState`, `adjustedCapacity`, …), `month-rail.js`, `regenerate.js`
- Brief 2: `validate.js` (now incl. **`isValidPoints`** — the single points authority `parsePoints` and `validatePlan` both consume), `backlog-selectors.js`, `epic-palette.js`
- Brief 3: `board-selectors.js` (`placedPoints`, `sprintPlacedPoints`)
- Brief 4: `overBy(placed, capacity)` in `plan-maths.js`
- **Brief 5: `plan-io.js` (new, pure, DOM-free)** — `validatePlan(plan) → { ok, plan } | { ok:false, reason }`; `migratePlan(plan)` (version-dispatch seam over the empty `MIGRATORS` map, `CURRENT_SCHEMA = 1`); `exportPlan(state, exportedAt)` (R2 file payload, `lastReturnedStoryIds` reset, caller supplies the clock); `extractPlan(parsed, mode)` (the leniency split, `mode` ∈ `"import"` | `"restore"`).

### View / glue modules

`dom.js`, `modal.js`, `backlog.js`, `card-editor.js`, `epic-editor.js`, `render.js`, `drag.js`, `banner.js` (Brief 4). **Brief 5 added no view module** — the file plumbing is thin glue in `main.js`:
- `loadOrInit`: parse → `extractPlan(_, "restore")` → `migratePlan` → `validatePlan` → `normalise` (lastReturnedStoryIds → []); fresh-plan fallback on any structural failure (R5).
- autosave subscriber: writes `{ savedAt: nowISO(), plan: state }` (R7).
- `tb-export` handler: `exportPlan(state, nowISO())` → `JSON.stringify` → `Blob` → temporary `<a download>` click (filename `slugify(title)-<date>.json`) → revoke URL.
- `tb-import` handler: opens the hidden file input; on change runs the full atomic pipeline and dispatches `loadPlan(normalise(plan))` only on success (R3); resets the input value so the same file can be re-picked.
- `index.html`: two G8 buttons (`#tb-export`, `#tb-import`) + a hidden `<input type="file">` in `.tbacts` (the existing `.topbar` actions area).
- `plan.css`: plum hover + `:focus-visible` ring for the two buttons (the suite `btn-ghost` default ring is black, so the brief's "plum focus rings" needed CSS, not just class reuse).

---

## Known limitation carried into Brief 6 (R5 clobber — recorded in build-log)

Until Brief 6 gives a bad save a home in the resume prompt, a **structurally-invalid autosave is discarded** (fresh plan), not recovered, and the next action's autosave overwrites it (the clobber). Brief 5 only stops the crash. **Closing this clobber is squarely Brief 6's job** — the resume prompt is where an unreadable/invalid save gets surfaced to the facilitator instead of silently dropped.

---

## What Brief 6 (Resume / New-plan prompt, Screen 3) will need to touch

The natural follow-on, and the slice that makes restore *honest*. **It builds on Brief 5's foundation and adds almost no new pure code** — the safety core already exists:

- **The `{ savedAt, plan }` envelope is already written.** Brief 5 writes `savedAt` on every autosave but renders nothing from it. Brief 6's resume card reads it for free for a "last edited" line. No storage-format change needed — that was done once, now.
- **`validatePlan` already exists** to decide whether a save is resumable. Brief 6 decides what to *do* with a `{ ok:false }` restore (surface it in the prompt) instead of silently dropping it — this is where the R5 clobber closes.
- **End silent restore (Screen 3).** Today `loadOrInit` restores automatically (validated, but with no prompt). Brief 6 renders the Resume / New-plan choice on load: resume the saved board, or start fresh.
- **Wire `NEW_PLAN` — the only destructive path in the app — with its escape hatch.** The start-new flow must offer "download your current board first" before it clobbers. `exportPlan` + the download glue already exist from Brief 5; Brief 6 reuses them as the escape hatch. This is why `NEW_PLAN` was kept dormant until now.
- **The resume summary line** ("3 months, 6 sprints, 14 stories, 47 pts placed") — derivable from existing selectors over the restored state.

Likely no schema change and no new pure module — mostly view + wiring over Brief 5's core. Keep one feature per brief: the dependencies schema bump stays in Brief 7.

## Deferred (candidate scope, in spec P0 order)

- **Brief 6 — Resume / New-plan prompt** (P0 #7 slice 2) — suggested next; see above. Closes the R5 clobber, ends silent restore, ships the guarded `NEW_PLAN` flow.
- **Brief 7 — Dependencies** (P0 #5) — now after Brief 6. The **heaviest slice**: first schema change since Brief 2 (`migratePlan` seam built in Brief 5 makes it additive — add `MIGRATORS[1]`, bump `CURRENT_SCHEMA`), `LINK_DEP` action, the card-editor Dependencies section + picker (grouped by sprint location, unblocked by Brief 3), the app's first SVG drawing layer (cross-sprint connectors), and violation borders. Strongly consider splitting (data + picker, then connectors).
- **Exports** (P0 #6) — the report's over-commitment list reuses Brief 4's `overBy`.
- Stretch toggle, labels, parked lane, stats strip (P1). Sub-1280px backlog drawer; dark mode.

## Open housekeeping (logged, not yet actioned)

- **Theme-token promotion still open** (carried, unactioned): promote `--plum`/`--plumwash`, `#glyph-plan`, and the 8 epic-palette tokens to the shared instrument-core source; register `plan` as a SURFACE in the theme `manifest.mjs` and add the `check-theme-drift` test. Suite-level, out of scope for a feature brief.
- **Dragula vendoring decision stands** (`docs/housekeeping-dragula-vendoring.md`): keep per-app copies; a shared suite copy is a suite-level change against a second live app, out of scope for any single feature brief.

## Branch / merge model (as now practised)

main carries briefs 1–4 (`0fdbeb6`). **Brief 5 is on `brief-5-board-file-io` (`2d99f3a`), pushed, PR pending — director's call.** It branched off `main` (no stacking — stacking only existed while main was frozen through Brief 3). Merge with `gh pr merge --merge` (merge commit, NOT squash/rebase) so the build-log's per-brief SHA references stay valid. **Brief 6 branches off main after Brief 5 merges.**

## Commands

```
npm test               # node --test tests/*.test.js, 91 tests
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve on http://localhost:3004
```

---

## Suggested next brief

**Brief 6 = Resume / New-plan prompt (Screen 3), P0 #7 slice 2.** Rationale: it closes the slice Brief 5 opened — it reuses everything built here (`validatePlan`, the `{ savedAt, plan }` envelope already written, `exportPlan` + download glue as the start-new escape hatch), ends silent restore, ships the guarded `NEW_PLAN` flow, and closes the R5 clobber. It is a light slice (mostly view + wiring, likely no new pure module and no schema change), which is the right size to keep one-feature-per-brief while the heavy dependencies slice (Brief 7) waits behind it. (Suggestion only — scope order is the director's call.)
