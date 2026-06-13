BRIEF 9: Exports, P0 #6 (the plan summary: markdown, printable HTML, CSV) — the last untouched P0

Read first: docs/sprintplan-mvp-spec.md (v0.5: P0 #6 "Plan summary export", resolved decision 3
"three export formats, shared data template, three renderers", P0 #1 "the title, when set, appears on
the board header and ALL exports", resolved decision 2 "a partial final sprint's capacity is
prorated", and the "zero data-loss bugs" quality bar), docs/v1-screen-designs.md (the export/share
control and ruling G8: the report export is ITS OWN control, distinct from the board .json
Save/Import), docs/user-journeys.md (the export-and-share journey: one click at the end of a session
produces a shareable summary), docs/aide-rules-of-engagement.md, and docs/build-state-after-brief8.md
(what the code actually is now, not just what the specs say; read the "What Brief 9 (Exports, P0 #6)
will need" section and the Known limitations). RoE cadence applies: PROPOSE before you build. No
feature code until I approve the approach. Feature branch per brief (brief-9-exports). Branch off main.

PRECONDITION (branch model): main carries briefs 1 to 8 once Brief 8's PR merges (--merge, not squash,
so the build-log SHAs stay valid). Brief 9 branches off main AFTER that merge. Do not stack on
brief-8-dependencies-drawing. This brief adds NO action and NO schema change: a report is a pure
render of state, the same shape as the slice 2 view.

GOAL
Give the facilitator the one-click shareable summary the whole tool exists to produce. From the live
board, render the plan as a clean summary in three formats: a markdown summary, a self-contained
printable HTML document, and a flat CSV (one row per story). Every format carries the plan title and
dated sprints, the per-sprint stories with points, the capacity status, a dedicated OVER-COMMITMENT
SECTION listing every sprint over capacity and by how much, and a DEPENDENCY-WARNINGS SECTION listing
every violating pair. This is a PURE RENDER OF STATE: one pure model selector and three pure string
renderers, plus thin download/print glue. It dispatches nothing, adds no action and no schema change,
and never writes the save envelope. After this brief, all P0 scope is shipped.

WHY THIS BRIEF, AND WHAT IT INHERITS
The dependency feature completed end to end in Brief 8, so isViolation is finished and the
over-commitment figures have existed since Brief 4. The report is the consumer of both. Everything it
needs is ready-made and confirmed in the live source (build-state-after-brief8.md):
- overBy(placed, capacity) in plan-maths.js (Brief 4) — the overshoot in points; overBy > 0 is
  provably identical to a non-neutral pill, so the over-commitment list can never disagree with the
  board.
- sprintCapacity(sprint, settings), pillState(placed, capacity), adjustedCapacity, proratedCapacity in
  plan-maths.js — capacity status and the prorated partial-sprint figure (resolved decision 2).
- sprintPlacedPoints(state, index), placedPoints(ids, stories), planSummary(state) in
  board-selectors.js — per-sprint placed points and the header numbers (months, sprint count, story
  count, total placed points).
- isViolation(state, dep), storyLocation(state, id), locationLabel(state, location), depLabel(state,
  dep) in dep-selectors.js — the dependency warnings, naming both endpoints and their sprints, with
  the shared D label. Backlog-touching pairs are neutral (G7) and are NOT warnings.
- state.epics / state.stories[id].epicId — epic grouping for the "epics, stories per sprint" summary
  (user story 7).
- exportPlan(state, exportedAt) / extractPlan(parsed, mode) in plan-io.js — the EXISTING .json
  round-trip control. The report is a DIFFERENT, distinct control (G8); do not route the report
  through this round-trip and do not make the report re-importable.
No new model maths. The novelty is the report model that assembles these reads into one shape, and the
three renderers over it.

THE GAP THIS BRIEF FILLS (read before you scope the model)
The atoms exist; the report-shaped aggregate does NOT. board-selectors.js gives per-sprint placed
POINTS (sprintPlacedPoints) but no per-sprint list of the placed STORIES with their titles and points,
which is the body of all three formats and the entirety of the flat CSV. Assembling sprint -> ordered
[{ storyTitle, points, epicTitle }], total, capacity, pillState, overBy is net-new work and is the
heart of this brief. Build it as a pure selector, TDD-first, the same way every prior slice built its
pure core.

ARCHITECTURE CONSTRAINT (non-negotiable, RoE quality gate)
- ONE pure model, THREE thin renderers (resolved decision 3). A single pure DOM-free selector builds
  the report data model from state; markdown / HTML / CSV are pure string renderers OVER that model.
  No renderer re-derives data from state. This is the testable surface; the renderers are thin.
- The model and all three renderers are PURE, DOM-free, and unit-tested with real plan states BEFORE
  any download glue. Only the click-to-download / print wiring is browser-verified, the same boundary
  every brief has kept its DOM on.
- The report READS state and returns strings. It dispatches nothing. No new action, no schema change,
  no store change, no validatePlan change to the load semantics (the one-line shape-guard in R8 is the
  only validatePlan touch, and it only makes a throw into a clean failure). The action vocabulary (17)
  and schema (v2) are untouched.
- No new clock-read PATTERN. If the report header carries a "generated at" stamp, it is passed in by
  the caller exactly as exportPlan takes exportedAt, so the model stays clock-free. todayISO/nowISO
  stay the only boundary clock reads.
- Reuse the existing pure selectors named above and the existing token set. Do not re-implement
  capacity maths, the violation rule, or the points authority in a renderer.
- ESCAPING IS PER-RENDERER, AND USER INPUT IS NEVER EMITTED RAW. Story titles and summaries are user
  input and must be escaped for the FORMAT each renderer produces. HTML renderer: entity-encode the
  ampersand, the angle brackets, and the double-quote. Markdown renderer: escape the metacharacters
  that would break a table row or inject formatting (the table-cell pipe, since per-sprint stories
  render as a table per the UI ruling, plus asterisk, underscore, backtick). CSV renderer: RFC-4180 quoting, wrap a field in double quotes and double any
  inner quote whenever it contains a comma, a quote, or a newline. Escaping lives in the renderers, not
  the model; the model holds the raw strings.

RULINGS BAKED INTO THIS BRIEF (director-ruled R1 to R8, do not silently change)
- R1 ONE SHARED MODEL, THREE RENDERERS. reportModel(state) is the single pure source of report data.
  toMarkdown(model), toHtml(model), toCsv(model) are pure string functions over it. A format never
  reaches past the model into state. (resolved decision 3.)
- R2 THE REPORT IS A PURE READ; IT NEVER WRITES. No dispatch, no action, no schema change, no store
  change. Critically, it must NOT write or touch the autosave envelope (localStorage key
  sprintplan:board) or any persistence: the report is output only. The board and the saved state are
  byte-identical before and after an export. (This is the data-loss bar, the app's one unforgivable
  failure, applied to the brief that most plausibly threatens the I/O surface.)
- R3 THE REPORT EXPORT IS ITS OWN CONTROL (G8). It is distinct from the board .json Save/Import
  (exportPlan/extractPlan). The report is human-facing output, never re-importable. Do not route it
  through the file round-trip and do not add a report header that pretends to be a loadable board.
  PROPOSE the control and where it sits relative to the existing Save/Import.
- R4 OVER-COMMITMENT IS A DEDICATED SECTION, ALWAYS PRESENT. Every sprint with overBy > 0 is listed
  with its overshoot in points; reuse overBy as the authority, never recompute. When NO sprint is over,
  the section says so explicitly (honesty on the record, not a silent omission). This section is the
  reason the export exists for stakeholders, per the spec.
- R5 DEPENDENCY WARNINGS REUSE isViolation. Every violating pair is listed textually, naming both
  stories (titles) and their sprints (locationLabel), with the shared D label. No board geometry in the
  report. Backlog-touching pairs are neutral (G7) and are NOT warnings. When none, the section says so.
- R6 CSV IS FLAT, ONE ROW PER STORY. Spreadsheet/Jira-friendly. RESOLVED (the title/summary question):
  the story SUMMARY is carried as its own CSV column (the Jira-friendly description field); the markdown
  and HTML formats show the story TITLE and points only and OMIT the summary, so they stay scannable
  for a Teams paste. PROPOSE the remaining columns (lean: epic, story, summary, points, sprint, sprint
  capacity, sprint status, dependency flag). Every PLACED story is a row; PROPOSE whether backlog
  stories are rows too (lean: include them with a "Backlog" sprint cell so nothing the facilitator
  entered is silently dropped). CSV escaping follows the per-renderer rule in the architecture
  constraint (RFC-4180 quoting on a comma, quote, or newline in a title or summary).
- R7 THE TITLE AND THE DATES CARRY (P0 #1, resolved decision 2). The optional plan title appears on
  ALL three exports when set. Sprints are dated from the start date. A partial final sprint is labelled
  partial and carries its PRORATED capacity (sprintCapacity already returns it), never the full figure.
- R8 THE deps SHAPE-GUARD LANDS HERE (explicit scope add, not adjacency). validatePlan currently
  reads d.blockerId on each deps element with no object guard, so a hand-edited deps: [null] THROWS at
  the load boundary instead of returning { ok: false, reason }. Add the one-line object/shape guard at
  the top of the deps loop so a malformed element fails cleanly like every other boundary failure.
  This is the only validatePlan change and it is in scope by ruling, not by "while we're here".

THE PURE CORE (build and unit-test FIRST, DOM-free)
PROPOSE the module home and exact names; a new pure module (e.g. report.js) holding reportModel plus
the three renderers, all DOM-free, is the natural home. Likely model shape:
- reportModel(state) returns:
  - header: { title (or null), months, sprintCount, storyCount, startDate, endDate, totalPlacedPoints,
    totalCapacity } (reusing planSummary and the per-sprint capacity sum).
  - sprints: one entry per sprint { name, startDate, endDate, isPartial, capacity, placed, pillState,
    overBy, stories: ordered [{ title, summary, points, epicTitle (or null) }] }. The model carries
    summary (raw) so the CSV renderer can emit it; markdown and HTML ignore it (the title/summary
    resolution, R6).
  - overCommitment: the sprints where overBy > 0, each { name, placed, capacity, overBy }.
  - warnings: the violating pairs, each { label, blockerTitle, blockerSprint, blockedTitle,
    blockedSprint }.
- toMarkdown(model) / toHtml(model) / toCsv(model): pure strings. HTML is self-contained and printable
  (PROPOSE: inline print-friendly CSS, no external assets, opens and prints with Ctrl+P).
Anything with branching (the over-commitment filter, the warnings filter, partial-sprint labelling, CSV
escaping, epic grouping) is unit-tested with real plan states, not eyeballed.

WIRING (the model, the renderers, the control, the shape-guard)
- Model + renderers (report.js, PROPOSE name): reportModel + toMarkdown/toHtml/toCsv, pure, exported.
- Control (PROPOSE the home and the affordance): a distinct export control (G8), separate from the
  board .json Save/Import. PROPOSE a menu / segmented choice of the three formats and whether it sits
  in the board header beside Save/Import or in its own spot. On choice: run reportModel(state), render
  the chosen format, and trigger a Blob download (markdown .md, CSV .csv, HTML .html) or the print
  view. This thin glue sits beside exportPlan's existing Blob glue in main.js but is its own control.
- Shape-guard (plan-io.js validatePlan): the one-line deps-element guard (R8). No other change to the
  load semantics.
- No change to the store, actions, schema, the storyCard signature, or the board render path.

UI (the control and the three outputs; everything else deferred)
- The export control: PROPOSE the affordance and placement (distinct from Save/Import, R3/G8). One
  click to a downloaded/printable artifact.
- Markdown: a clean, readable summary a facilitator can paste into Teams or attach to Confluence/Jira.
  Header (title, dates, totals), a section per sprint (dates, capacity, status, then the stories as a
  TABLE of title and points, no summary per R6), the over-commitment section, the dependency-warnings
  section. RESOLVED (table vs list): per-sprint stories render as a markdown TABLE, so the table-cell
  pipe in a title is escaped (per-renderer rule), as are a title's other metacharacters. A plain list
  is an acceptable PROPOSE alternative; if chosen, the pipe clause is moot but the rest still applies.
- Printable HTML: the same content as a self-contained document that prints cleanly (PROPOSE inline
  CSS; no external fonts/assets so it prints offline). Suite-consistent but print-first, not screen-
  decorative. All user text (story titles, the plan title) is entity-escaped (per-renderer rule),
  never emitted as raw markup.
- CSV: flat, one row per story, header row, including the story summary column (R6), RFC-4180 escaped
  (per-renderer rule). Opens cleanly in a spreadsheet.

OUT OF SCOPE (parking lot; do not "while we're here" these, RoE anti-pattern)
- The directional duplicate check in validatePlan stays AS IS and is NOT changed here. A reverse pair
  (A blocks B and B blocks A) passing validation is intentional: it surfaces a 2-cycle as honest mutual
  violation flags rather than silently dropping one direction, and cycle detection is deferred by
  ruling. Do not "fix" it into a bidirectional check; that would suppress the honest mutual violation.
  (Logged in build-state-after-brief8.md; recorded here as a deliberate non-change.)
- The .json board Save/Import round-trip (exportPlan/extractPlan). Untouched; the report is a separate
  control (R3).
- Cycle detection (deferred by ruling).
- Stretch toggle and the separate stretch listing in the report (P1). The report counts every placed
  story in its sprint total honestly; a separate stretch section is a fast-follow once the toggle
  exists. Do not pre-build the toggle to feed it.
- Contextual tooltips, labels/colour tags, parked lane, stats strip (P1); sub-1280px backlog drawer;
  dark mode; persistent New-plan control; multiple boards (P2).
- Any board-render change, any new action, any schema change, any zoom/scrollport (none exists).

ASSERTED CASES (assert these exact outcomes; derive the rest; tests assert real values)
Build fixtures as real plan states (a titled plan; sprints with placed stories of known points; one
over-capacity sprint; a partial final sprint; a violating dependency pair; one backlog story; one story
with no epic; one story whose TITLE contains format-hostile characters (a pipe, angle brackets, an
ampersand, a double-quote, a comma) and whose SUMMARY additionally contains a newline). Pure model and
renderers:
1. HEADER CARRIES TITLE AND TOTALS. reportModel on a titled plan carries the title, months, sprint
   count, story count, start/end dates, and total placed points vs total capacity (matching
   planSummary and the per-sprint capacity sum). Title null when unset.
2. SPRINT BLOCKS MATCH THE BOARD. Each sprint entry lists its placed stories in order with points,
   the placed total, the capacity, the pillState, and overBy, matching plan-maths for that fixture.
3. OVER-COMMITMENT LISTS EXACTLY THE OVER SPRINTS. overCommitment contains exactly the sprints with
   overBy > 0, each with its overshoot; an empty list when none (and the renderers say so explicitly).
4. WARNINGS LIST EXACTLY THE VIOLATIONS. warnings contains exactly the pairs where isViolation is
   true, naming both endpoints and their sprints; backlog-touching and correctly-ordered pairs are
   absent.
5. PARTIAL SPRINT IS PRORATED AND LABELLED. A partial final sprint carries its prorated capacity (not
   the full figure) and is labelled partial in all three renderers.
6. MARKDOWN renders the header, per-sprint sections, the over-commitment section, and the warnings
   section from a model containing all four; AND a story title containing markdown metacharacters (a
   pipe, an asterisk, a backtick) is escaped so it neither breaks a table row nor injects formatting.
7. HTML is a self-contained document (contains its own style, no external asset reference) carrying
   the same sections; AND a story title containing the angle brackets, the ampersand, and the
   double-quote is emitted as HTML entities, never as raw markup.
8. CSV is one row per story with a header row, the correct columns including the summary (R6), and
   RFC-4180 escaping. The summary (the multiline field) contains a comma, a double-quote, AND a
   newline; the title contains a comma and a double-quote (titles are single-line, so the newline path
   is exercised by the summary). Each field is wrapped, inner quotes are doubled, and the embedded
   newline does not split the row.
9. SHAPE-GUARD (R8). validatePlan on a plan with deps: [null] returns { ok: false, reason } and does
   NOT throw; a well-formed deps array still returns { ok: true }.
10. NO MUTATION AT THE PURE LAYER (R2 at its cheapest). Deep-freeze a fixture state, then run
   reportModel and all three renderers over it: none throws, and the state deep-equals a clone taken
   before the call. This catches an accidental mutation at the unit layer, before it could reach the
   autosave envelope the browser case guards.
Browser-verified, not unit cases:
- The export control offers the three formats and produces a downloaded .md, .csv, and .html (or a
  print view) for each, no console error.
- The exported content reflects the LIVE board at click time (placements, capacity status as text,
  the over-commitment list, the violations).
- The export control is distinct from Save/Import (R3/G8). Using it does NOT change board state, does
  NOT dispatch, and leaves the sprintplan:board autosave envelope byte-identical (R2). Confirm the
  saved state is unchanged after an export.
- Zero console errors across the above.

HOUSEKEEPING (carry-forward, still NOT actioned this brief; record as remaining open)
- Theme-token promotion still open (now grown to include --dep-line from Brief 8): promote --plum /
  --plumwash, #glyph-plan, the 8 epic-palette tokens and --dep-line to shared instrument-core; register
  plan as a SURFACE in the theme manifest.mjs and add the check-theme-drift test. If the printable HTML
  introduces any print-only token, fold it into the same promotion. Suite-level, out of scope for a
  feature brief.
- Dragula vendoring decision stands (docs/housekeeping-dragula-vendoring.md): keep per-app copies. No
  action.
- Doc/code naming note from Brief 6 still stands: extractPlan's upload mode is "file" in code.
- The directional duplicate check (above) is recorded as a deliberate non-change, not an open item.

BRANDING
instrument-core tokens, data-app="plan". The export control uses the plum accent and :focus-visible
rings like every other control. The printable HTML is suite-consistent but print-first: legible at
A4/Letter, no screen-only decoration, no external font/asset (so it prints offline). The plan title,
when set, heads every format. Minimum 13px body, mono numbers 12px+ where the screen styles apply;
print CSS sets its own legible sizes.

DEFINITION OF DONE
- reportModel and the three renderers are pure, DOM-free, and unit-tested with real states: header and
  totals (1), sprint blocks match plan-maths (2), the over-commitment list is exact and honest when
  empty (3), the warnings list is exactly the violations (4), the partial sprint is prorated and
  labelled (5), and each renderer produces its sections AND escapes its own format's special
  characters in user input (6, 7, 8).
- One shared model feeds three thin renderers; no renderer re-derives data from state (R1). The report
  reuses overBy, isViolation, sprintCapacity, pillState and the points authority; none is
  re-implemented.
- The over-commitment section lists every over sprint by its overshoot and says so when none (R4); the
  dependency-warnings section lists every violation by name and sprint (R5); the title and dated/
  partial sprints carry on all three formats (R7).
- The CSV is flat, one row per story, carries the summary column, and is RFC-4180 escaped (R6). The
  markdown and HTML formats show title and points only, summary omitted (the title/summary resolution,
  R6); every renderer escapes its own format's special characters in user input.
- The report is a pure read: no dispatch, no action, no schema change, and the board and the
  sprintplan:board autosave are byte-identical before and after an export (R2). Defended at the pure
  layer by a deep-freeze / no-mutation unit case (10) AND verified in the browser.
- The export is its own control, distinct from the .json Save/Import (R3/G8).
- validatePlan fails cleanly on deps: [null] (R8); the one-line guard is the only load-semantics touch.
- Verified in the browser against the export journey, zero console errors.
- I can explain every line. Build-log entry drafted (AI drafts, I sign off). The handoff note records
  that with Exports shipped, ALL P0 scope is complete, and that the natural next step is MVP launch
  (closing retrospective, README, launch checklist) followed by the P1 fast-follow list.

Start by PROPOSING: the reportModel shape and its exact module home and name; the three renderer
signatures and the printable-HTML approach (self-contained .html download vs print view); the export
control affordance and where it sits relative to Save/Import (G8); the remaining CSV columns and the
backlog-rows decision (the summary column is already resolved, R6); confirm the markdown stories layout
(resolved as a table; flag if you would render a list instead); and the minimal placement of the
one-line deps shape-guard in validatePlan
(R8). No feature code yet.

SUGGESTED NEXT BRIEF
With Exports shipped, all P0 scope is complete: this is MVP. The natural next step is not a feature
brief but MVP LAUNCH: the closing retrospective (RoE), a README stub with the pitch and links to the
spec and build log, and a launch checklist (licence, no secrets in history, security alerts). After
launch, the P1 fast-follow list (stretch toggle and its report section, tooltips, parked lane, labels,
stats strip, dark mode). (Suggestion only; scope order is the director's call.)
