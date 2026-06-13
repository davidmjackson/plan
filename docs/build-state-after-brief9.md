# Build state after Brief 9 — handoff (ALL P0 COMPLETE → MVP launch)

**Purpose**: Ground the next session in what the code *actually is* after Brief 9, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build. **Brief 9 was the last untouched P0 — with Exports shipped, all P0 scope is complete. The next step is not a feature brief but MVP LAUNCH** (closing retrospective, README, launch checklist), then the P1 fast-follow list.
**As of**: branch `brief-9-exports` off `main` (PR #6 merged `main` to `264e2ed` first). Tree: feat + build-log drafted, **146 unit tests green**, `tsc --noEmit` clean, **headless Chromium export checks pass, zero console errors**. PR pending the director's sign-off of the build-log entry.
**Companions**: sprintplan-mvp-spec.md (v0.5), v1-screen-designs.md (v1.0), user-journeys.md (v1.0), aide-rules-of-engagement.md, build-log.md, build-state-after-brief1.md…build-state-after-brief8.md, housekeeping-dragula-vendoring.md, brief9.md.

---

## What Brief 9 shipped

**Exports — the plan summary in three formats (P0 #6).** A PURE RENDER OF STATE: one pure DOM-free model and three pure string renderers, plus thin download glue. **No new action, no schema change, no store change.** The report **dispatches nothing and never writes the autosave envelope** (R2, the data-loss bar) — verified byte-identical in the browser.

- **One pure module** added: `public/js/report.js`.
  - `reportModel(state)` → `{ header, sprints, backlog, overCommitment, warnings }`, assembled from the existing authorities (`planSummary`, `sprintPlacedPoints`, `sprintCapacity`, `pillState`, `overBy`, `isViolation`, `locationLabel`, `depLabel`, `storyLocation`). **No new maths** — it holds RAW user strings; escaping is each renderer's job.
  - `toMarkdown(model)` / `toHtml(model)` / `toCsv(model)` — pure strings. **Per-renderer escaping**: Markdown escapes pipe/asterisk/underscore/backtick (table-cell + formatting injection); HTML entity-encodes `& < > "`; CSV is RFC-4180 (wrap on comma/quote/newline, double inner quotes). Over-commitment and warnings each say so explicitly when empty (R4/R5).
- **The R8 deps shape-guard** in `plan-io.js`: a one-line `if (!isObject(d))` at the top of the `validatePlan` deps loop, so a hand-edited `deps: [null]` fails cleanly instead of throwing. The only `validatePlan` change.
- **Browser glue** (the only DOM): `downloadText` gained a `mime` param; a distinct `#tb-report` "Export summary ▾" `<details>` menu in the topbar.

Built TDD pure-first (+16 report tests, +1 R8 test, 129 → 146), browser-verified for the glue (the same DOM boundary every prior slice kept its DOM on).

---

## Architecture as built (the contract a future brief extends)

Everything from briefs 1–8 still holds. Brief 9 added a pure module, one `validatePlan` line, and one topbar control. Load-bearing facts:

- **The report is the consumer, not an author.** `reportModel` reads state and returns plain data; the three renderers turn that into strings. Nothing in the report path dispatches, mutates, or touches persistence. The deep-freeze unit case (10) pins no-mutation at the cheapest layer; the browser case pins the `sprintplan:board` envelope byte-identical across all three exports.
- **One model, three renderers (R1).** No renderer reaches past the model into state. The model holds raw strings; **escaping is per-renderer** and lives in the renderers (`mdEscape` / `htmlEscape` / `csvField` in `report.js`). If a fourth format is ever added, it is a fourth pure renderer over the same model.
- **`planSummary` carries no capacity and no dates** — `reportModel` derives `totalCapacity` (Σ `sprintCapacity`), `startDate` (settings) and `endDate` (last sprint) itself. Sprint objects already carry `startDate`/`endDate`/`isPartial`/`days`, so per-sprint dates and the partial flag are reads.
- **The story model.** `state.stories[id]` = `{ id, title, summary, points, epicId }`; the report shows `title` + `points` in markdown/HTML and adds `summary` + `epic` only in the flat CSV (R6). Each story row in the model also carries an `inViolation` flag (the CSV dependency column) — reused from `isViolation`, so it can never disagree with the warnings section.
- **The report control is its own (G8).** `#tb-report` is a separate topbar control from the board `.json` Save/Import (`#tb-export` / `#tb-import`, which round-trip through `exportPlan`/`extractPlan`). The report is human-facing output, never re-importable. A thin `.tbacts-sep` divides the two groups.

### State shape, actions, schema — UNCHANGED

Still `schemaVersion: 2`, `deps: [{ id, blockerId, blockedId }]`, **17 actions**, `validatePlan` the load-path spine (now with the R8 element guard).

### Pure functions available (all unit-tested, DOM-free)

As after Brief 8, plus **`reportModel` / `toMarkdown` / `toHtml` / `toCsv`** in `report.js`. All other selectors unchanged.

### View / glue modules

As after Brief 8, plus:
- **`main.js`** — `downloadText(text, filename, mime = "application/json")`; a `REPORT_FORMATS` table and `exportReport(format)` (pure read → render → Blob download); one `[data-export]` delegated click that runs the export and collapses the `<details>`.
- **`index.html`** — `#tb-report` `<details class="export-menu">` with three `[data-export]` buttons (md/html/csv) + a `.tbacts-sep` divider before the board file buttons.
- **`plan.css`** — `.export-menu` / `.export-menu-list` (native `<details>` dropdown, plum accent + `:focus-visible` rings, no JS for open/close) and `.tbacts-sep`.

---

## Known limitations / notes carried forward

- **Two slice-1 I/O notes are now closed or recorded.** The R8 shape-guard is **DONE** (this brief). The directional duplicate check **stays as is** by ruling — a reverse pair A↔B is a deferred 2-cycle surfaced as honest mutual violation flags, not a duplicate; do NOT make it bidirectional.
- **Cycle detection is still deferred (by ruling).** Self-dep + duplicate-pair rejected at picker + load boundary; a true cycle yields honest mutual violation flags, no DFS.
- **The report omits the story summary from markdown/HTML by design (R6)** — those formats stay scannable for a Teams paste; the CSV is the Jira-friendly full export with the summary column. The D number still renumbers on removal (derived, intended).
- **Doc/code naming note still stands** (from Brief 6): `extractPlan`'s upload mode is `"file"` in code.

---

## What MVP LAUNCH will need (the suggested next session — NOT a feature brief)

Per the RoE and the brief's own suggestion, with all P0 shipped the next cut is launch, not features:
- **Closing retrospective** (RoE) — the Capstone reflection across briefs 1–9.
- **README stub** — the pitch + links to `sprintplan-mvp-spec.md` and `build-log.md`.
- **Launch checklist** — licence (already `AGPL-3.0` in package.json), no secrets in history, security alerts.

## Deferred (P1 fast-follow, in spec order)

- **Stretch toggle and its report section** — the report already counts every placed story in its sprint total honestly; a separate stretch *listing* in the report is the fast-follow once the toggle exists. Do NOT pre-build the toggle to feed it.
- Contextual tooltips, the parked lane, labels/colour tags, the stats strip (P1). Sub-1280px backlog drawer; dark mode. A persistent/mid-session New-plan control (Brief 6 R4 deferred it); multiple boards (P2). A horizontal/swimlane board re-orientation (a separate, larger board brief).

## Open housekeeping (logged, not yet actioned)

- **Theme-token promotion still open** (carried): promote `--plum`/`--plumwash`, `#glyph-plan`, the 8 epic-palette tokens **and `--dep-line`** to shared instrument-core; register `plan` as a SURFACE in the theme `manifest.mjs` + add the `check-theme-drift` test. The printable HTML uses **inline** print CSS (no shared token), so it introduced no new promotable token. Suite-level, out of scope for a feature brief.
- **Dragula vendoring decision stands** (`docs/housekeeping-dragula-vendoring.md`): keep per-app copies.

## Branch / merge model (as now practised)

`main` carries briefs 1–8 (PR #6 merged to `264e2ed`, merge commit). **Brief 9 is on `brief-9-exports`, branched off `main` after that merge** (no stacking). PR pending the director's sign-off of the build-log entry; merge with `gh pr merge --merge` (merge commit, not squash/rebase) so the build-log's per-brief SHA references stay valid.

## Commands

```
npm test               # node --test tests/*.test.js, 146 tests
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve on http://localhost:3004
```

Headless browser verification: no Playwright in this repo; require it from a sibling (`/var/www/signal/node_modules/playwright`, browsers cached in `~/.cache/ms-playwright`) in a CommonJS script. The localStorage state key is `sprintplan:board` (a `{ savedAt, plan }` envelope — unwrap `.plan`); autosave fires on dispatch, not on init, and the store ALWAYS boots fresh (a valid save raises the Brief 6 resume prompt). To seed real state: build the envelope with the real reducers, inject it via `context.addInitScript` BEFORE app scripts run, navigate, and click `.rp-resume`. For exports specifically: `acceptDownloads: true`, open `#tb-report summary`, click `[data-export="md|html|csv"]`, await the `download` event, read `download.path()`; capture `localStorage["sprintplan:board"]` before and after to assert R2 byte-identity.

---

## Suggested next session

**MVP LAUNCH (all P0 shipped — this is the MVP).** Not a feature brief: the closing retrospective, a README stub, and a launch checklist, then the P1 fast-follow list above. (Suggestion only — scope order is the director's call.)
