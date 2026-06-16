BRIEF 5: Board file export and import (P0 #7, slice 1 of 2)

Read first: docs/sprintplan-mvp-spec.md (v0.5: P0 #7, and the "zero data-loss bugs" quality
bar that this slice exists to defend), docs/v1-screen-designs.md (v1.0: Screen 5 ruling G8,
"Board file (.json save/load) lives in the top bar; report export lives in the export dialog;
never mixed", and the cross-cutting Autosave rule), docs/aide-rules-of-engagement.md, and
docs/build-state-after-brief4.md (what the code actually is now, not just what the specs say).
RoE cadence applies: PROPOSE before you build. No feature code until I approve the approach.
Feature branch per brief (e.g. brief-5-board-file-io). Branch off main.

GOAL
Make the board a file you can trust. P0 #7 is "local persistence plus file export/import". The
autosave half already works (every action persists; refresh loses nothing). This slice adds
the explicit file half and, more importantly, the validation that the existing load paths skip
today. A facilitator can download the current board as a .json, and import a .json back, with a
bad or foreign file refused cleanly and the current board never harmed. The safety core
(validate plus migrate) is pure and unit-tested first; the file plumbing and the top-bar
control are wired second.

This is slice 1 of 2. Brief 6 is the Resume / New-plan prompt (Screen 3) that ends silent
restore and reuses everything built here. This brief does NOT build that prompt, the summary
line, or the destructive start-new flow.

WHAT THIS SLICE EXTENDS (from build-state-after-brief4.md and the live source)
The scaffolding is half-cut and the danger is already in the tree:
- actions.js already defines LOAD_PLAN (creator loadPlan(state)) and NEW_PLAN (creator
  newPlan(startDate)). Both are real reducer cases. NEITHER is imported or dispatched anywhere
  in main.js. They are dormant scaffolding from Brief 1.
- store.js reducer: LOAD_PLAN returns action.payload verbatim, with ZERO validation. Whatever
  is handed to it becomes the entire store, bypassing every invariant the reducer otherwise
  protects (id conservation, atomic deletes, points rules).
- main.js loadOrInit() reads localStorage["sprintplan:board"], JSON.parse()s it, and returns it
  DIRECTLY as initial state. Its try/catch only catches a parse failure (corrupt text). A
  successfully-parsed but structurally-wrong object (old shape, hand-edited file, partial
  state) loads as-is and then crashes the renderer or silently corrupts the board.
- The autosave subscriber (main.js) persists JSON.stringify(state) on every state. Solid; the
  gap is everything around trusting what comes back.
- validate.js (Brief 2) already validates story points (positive integer). Reuse its points
  rule; do not re-implement it.
- The state shape carries no timestamp. meta is { title, schemaVersion: 1 } and nothing reads
  schemaVersion.
- .topbar chrome exists (suite standard). G8 puts the save/load control there.

This brief adds NO new action type and changes the state shape NOT AT ALL (schemaVersion stays
1). It activates LOAD_PLAN (built Brief 1, wired now via a validated import) and adds a pure
I/O layer plus the file plumbing and the top-bar control. NEW_PLAN stays dormant (see scope).

THE FINDING THAT DRIVES THIS BRIEF (read before the rulings)
There are TWO unvalidated load paths and both are live data-loss landmines: loadOrInit() returns
parsed JSON straight as state, and LOAD_PLAN returns its payload verbatim. The spec's one
unforgivable failure is lost or corrupted board state. So the spine of this brief is a single
pure validatePlan(plan) that every load path must pass through, and an import that is ATOMIC:
validate first, and a failed import never touches the current board. The asserted cases below
are built so that a dangling id, a foreign file, or an unknown schema version fails the
validator, not the renderer.

RULINGS BAKED INTO THIS BRIEF (director-ruled R1 to R7, do not silently change)
These were closed in the authoring review. They are decisions, not open questions. The
mechanism details under each are PROPOSE items.

- R1 VALIDATION LIVES AT THE BOUNDARY; THE REDUCER STAYS PURE. validatePlan runs in the import
  handler and in loadOrInit, before any dispatch. LOAD_PLAN's reducer case stays trivial
  (return the payload): it is only ever dispatched with an already-validated state, and that
  boundary is the single guarantee. Do not harden the reducer; do not move validation into it.
  This matches the codebase rule (ids minted in creators, validation at the edge).

- R2 THE EXPORTED .json CARRIES A SELF-IDENTIFYING HEADER. The file is not bare state. It is
  { app: "sprintplan", schemaVersion, exportedAt, plan: <state> }. A foreign or wrong-app file
  then fails import with a clear "not a sprintplan board", not a vague shape error. exportedAt
  is an ISO string stamped at export time (a boundary clock read, never in state).

- R3 IMPORT IS ATOMIC; A BAD FILE NEVER HARMS THE CURRENT BOARD. Read, parse, unwrap, migrate,
  validate, and only on success dispatch loadPlan(validatedState). On any failure, show a clear
  error and leave the board exactly as it was. The zero-data-loss bar applies to the import
  path itself, so this is verified in the browser (DoD).

- R4 BUILD THE VERSION-DISPATCH MIGRATION SEAM NOW. Only schemaVersion 1 exists today, so the
  migration is a near-no-op, but the seam must exist so the dependencies schema bump (Brief 7)
  is additive, not a retrofit. migratePlan(plan) dispatches on schemaVersion: v1 passes through
  to validation; a MISSING version, or a version NEWER than this build knows, fails clearly
  ("saved by a newer version of sprintplan"), it never silently loads. PROPOSE the seam shape
  (a version-keyed map or a switch); keep it minimal, this is not an abstraction layer.

- R5 THE LOADER NOW VALIDATES THE RESTORE; FULL RECOVERY IS BRIEF 6. loadOrInit runs
  migrate+validate on the restored value and, on structural invalidity, falls back to a fresh
  plan exactly as it already does on a parse error (extend the existing catch to cover invalid
  shape, not just unparseable text). KNOWN LIMITATION to record in the build log: until Brief 6
  gives a bad save a home in the resume prompt, an invalid autosave is discarded, not recovered,
  and the next action's autosave overwrites it (the clobber). Brief 6 closes this; Brief 5 only
  stops the crash. Do not build recovery UI here.

- R6 lastReturnedStoryIds NORMALISES TO [] ON ANY LOAD. It is transient toast-trigger state and
  is meaningless across a load or import boundary. exportPlan resets it to [] in the emitted
  plan, and any loaded/imported state is normalised to [] before it becomes the store, so no
  stale "returned to backlog" toast fires on load.

- R7 INTRODUCE THE localStorage ENVELOPE NOW. Autosave persists { savedAt, plan: <state> }, with
  savedAt an ISO string stamped IN THE AUTOSAVE SUBSCRIBER at serialize time (a boundary clock
  read, never in store state, never through an action, the same discipline as todayISO being
  the one clock read in main.js). loadOrInit tolerates the legacy bare-state form (pre-Brief-5
  saves have no envelope) and the new enveloped form. Brief 6's resume card reads savedAt for
  free; this brief writes it but renders nothing from it.

THE SUBTLE CALL (flag hardest here): TWO ENVELOPES, ONE INNER PLAN, AND THE UNWRAP LENIENCY
There are now two wrappers for two surfaces, and they must not be conflated:
- The exported FILE (R2): { app, schemaVersion, exportedAt, plan }.
- The localStorage SAVE (R7): { savedAt, plan }.
Both wrap the same inner plan state, and validatePlan validates ONLY that inner plan. PROPOSE a
single extractPlan(parsed) that returns the inner plan from whichever form it is handed, with
DIFFERENT leniency per path:
- Import (file): REQUIRE the app header. A file without app === "sprintplan" is refused as
  foreign (R2). No legacy bare-state files exist, because export did not exist before this brief.
- Restore (localStorage): accept the { savedAt, plan } envelope OR a legacy bare state object
  (our own pre-Brief-5 writes). We trust our own storage key more than an arbitrary uploaded
  file, so bare-state tolerance is acceptable here and only here.
This split is the load-bearing safety distinction of the brief: lenient where we wrote the
bytes, strict where the user did. If you would rather require the envelope on restore too and
treat a legacy bare save as invalid (forcing a fresh plan for anyone mid-session at upgrade
time), say so; I recommend tolerating it, since discarding a valid legacy board would itself be
the data loss we are here to prevent.

ARCHITECTURE CONSTRAINT (non-negotiable, RoE quality gate)
- validatePlan, migratePlan, exportPlan, and extractPlan are PURE, DOM-free, and unit-tested
  before any file plumbing or DOM is wired, the same pattern Brief 1 used for capacity maths and
  Brief 3 for placed points. The browser-only pieces (Blob download, file read) are thin glue
  over the tested core and are verified in the browser, not unit-tested, the same way Brief 3
  kept the drag gesture out of the unit net.
- The ONE new clock read for savedAt is in the autosave subscriber at serialize time. savedAt
  and exportedAt never enter store state and never pass through an action. The reducer stays a
  pure function of (state, action) with no time dependency.
- The view never mutates state. Import dispatches the existing loadPlan action with a validated
  payload. Export and download read state, they never write it.
- No new action type. The 15-action vocabulary is unchanged. The state shape is unchanged
  (schemaVersion stays 1). The envelopes are persistence-boundary concerns, outside the store.

THE PURE CORE (build and unit-test FIRST, DOM-free)
PROPOSE the module home and names (e.g. a new plan-io.js, or splitting validate-plan.js from
the existing validate.js); keep it close to the existing validate.js and reuse its points rule.
- validatePlan(plan) returns a discriminated result, e.g. { ok: true, plan } or { ok: false,
  reason }. It checks, at minimum: meta, settings, sprints, backlog, epics, stories are all
  present and the right kind; schemaVersion is known; every id in backlog and in every sprint's
  placedStoryIds exists in stories; no id appears in more than one array (conservation, the same
  invariant MOVE_STORY protects, now enforced at the load boundary); every story.epicId is null
  or an existing epic; every story's points pass validate.js's positive-integer rule. The reason
  string is human-readable and names the first failure (it surfaces in the import error).
- migratePlan(plan) dispatches on schemaVersion per R4: v1 to validation; missing or newer
  version fails clearly. The seam where a future v1-to-v2 migration plugs in (Brief 7).
- exportPlan(state) returns the FILE payload (R2 header) with the inner plan's
  lastReturnedStoryIds reset to [] (R6). Pure: it takes state and the exportedAt string as an
  argument (so it stays clock-free and testable); the caller supplies the timestamp.
- extractPlan(parsed) returns the inner plan from the file form, the stored-envelope form, or
  (restore path only) legacy bare state, per the leniency split above.

WIRING (activate LOAD_PLAN; harden the loader; autosave envelope)
- Import handler: a hidden <input type="file" accept="application/json,.json">; on change, read
  the file (await file.text()), JSON.parse in a try/catch, extractPlan (file leniency: require
  the app header), migratePlan, validatePlan; on ok, dispatch loadPlan(validatedPlan) (which
  autosaves and repaints for free); on any failure, show a clear, non-blocking error and leave
  the board untouched (R3). Reset the input value so the same file can be re-picked.
- Export/download: build exportPlan(state, nowISO()), JSON.stringify, Blob, object URL, a
  temporary <a download=...> click, then revoke the URL. PROPOSE the filename scheme (e.g. the
  slugified plan title or "untitled-plan" plus the date, .json).
- loadOrInit (main.js): parse, extractPlan (restore leniency: envelope or legacy bare),
  migratePlan, validatePlan; on ok, normalise lastReturnedStoryIds to [] and use it; on any
  failure, fall back to createInitialState(nextMonday(todayISO())) exactly as today (R5). Record
  the clobber limitation in the log.
- Autosave subscriber (main.js): persist { savedAt: nowISO(), plan: state } instead of bare
  state (R7). savedAt is read here, at the boundary, never in state.

UI (Screen 5 ruling G8 only: the top-bar Save / load control)
- A "Save / load" control in the .topbar actions area, holding two affordances: "Download board
  (.json)" and "Import board (.json)". PROPOSE whether it is two plain buttons or a small menu;
  keep it minimal and consistent with suite topbar conventions.
- This control is for the BOARD FILE ONLY. It must NOT host report export (markdown/HTML/CSV,
  P0 #6) and must NOT host a New-plan button (see scope). G8 keeps board-file and report-export
  on separate controls; honour that separation now so Brief 6 and the P0 #6 export brief slot in
  cleanly.
- Plum accent for the buttons and focus rings; mono for any data; no capacity colours anywhere
  on this control (amber/red mean capacity and nothing else). Minimum 13px body.

OUT OF SCOPE (parking lot; do not "while we're here" these, RoE anti-pattern)
- The Resume / New-plan prompt (Screen 3) and the end of silent restore. Brief 6. This brief
  leaves restore automatic but now VALIDATED; it renders no prompt.
- The resume summary line ("3 months, 6 sprints, 14 stories, 47 pts placed") and any "last
  edited" DISPLAY. Brief 6. This brief writes savedAt but renders nothing from it.
- NEW_PLAN wiring and the destructive start-new flow with its download-first escape hatch. That
  path is "the only destructive path in the app" and ships with its escape hatch in the resume
  prompt (Brief 6). Shipping an unguarded New-plan button here would be a data-loss path, so
  NEW_PLAN stays dormant exactly as it is today.
- Report export in any format (P0 #6). The over-commitment section of the report will reuse the
  Brief 4 overBy figure, but the report is a separate brief and a separate control (G8).
- Dependencies (P0 #5), now Brief 7. The schemaVersion bump and the v1-to-v2 migration land
  there; this brief only builds the seam.
- Stretch toggle, labels, parked lane, stats strip (P1). Sub-1280px backlog drawer; dark mode.

ASSERTED CASES (assert these exact outcomes; derive the rest; tests assert real values)
Build fixtures as real plan states (a fresh default plan, and a plan with placed stories).
1. FRESH DEFAULT PLAN VALIDATES. createInitialState(...) passes validatePlan: ok.
2. REAL PLACED PLAN VALIDATES. A plan with stories placed across sprints and some in backlog
   passes: ok.
3. MISSING TOP-LEVEL KEY FAILS, NAMED. A plan with stories deleted fails; reason names the
   missing key.
4. DANGLING BACKLOG ID FAILS. A backlog id with no matching entry in stories fails (the
   conservation breach), reason identifies it.
5. DANGLING PLACED ID FAILS. A sprint placedStoryIds id with no matching story fails.
6. DUPLICATE ID FAILS. The same story id present in two arrays (e.g. backlog and a sprint, or
   two sprints) fails. Together with 4 and 5 this pins the full conservation invariant at the
   load boundary.
7. ORPHAN epicId FAILS. A story whose epicId names a non-existent epic fails.
8. BAD POINTS FAIL. A story with points 0, negative, or non-integer fails (reusing validate.js).
9. SCHEMA VERSION GUARD. Missing schemaVersion fails; schemaVersion 2 (newer than this build)
   fails with a "newer version" reason; schemaVersion 1 with an otherwise-valid plan passes.
   This is the seam that lets Brief 7 bump the version safely.
10. FOREIGN FILE FAILS ON IMPORT. A parsed object with no app: "sprintplan" header is refused by
    the import path's extractPlan as "not a sprintplan board" (R2), distinct from a malformed
    plan.
11. ROUND-TRIP CONSERVATION. validatePlan(extractPlan(exportPlan(state, t))).plan deep-equals
    state with lastReturnedStoryIds normalised to [] (R6). What is exported and re-imported is
    exactly what was there, no loss, no drift.
12. LEGACY BARE-STATE RESTORE TOLERATED. extractPlan on a bare valid state (no envelope), restore
    leniency, returns it and it validates: a pre-Brief-5 autosave still loads (R7, the
    no-data-loss-on-upgrade case).
Browser-verified, not unit cases: a deliberately broken import (foreign file, dangling id)
leaves the on-screen board untouched (R3); a clean export re-imports to an identical board; a
legacy bare save in localStorage loads without error; the new envelope round-trips savedAt.

HOUSEKEEPING (carry-forward, still NOT actioned this brief; record as remaining open)
- Theme-token promotion still open: promote --plum / --plumwash, #glyph-plan, and the 8
  epic-palette tokens to the shared instrument-core source; register plan as a SURFACE in the
  theme manifest.mjs and add the check-theme-drift test. Suite-level, out of scope for a feature
  brief.
- Dragula vendoring decision already written (docs/housekeeping-dragula-vendoring.md, Brief 4):
  keep per-app copies; no cross-repo move. No action.

BRANDING
instrument-core tokens, data-app="plan". The Save / load control uses standard .topbar chrome,
plum accent for buttons and focus rings, IBM Plex Mono for any number, dates, or counts. No
capacity colours on this control. Minimum 13px body, mono numbers 12px+.

DEFINITION OF DONE
- validatePlan, migratePlan, exportPlan, extractPlan have passing unit tests asserting the cases
  above with real values, including the conservation cases (4, 5, 6), the schema-version guard
  (9), and the round-trip (11). The points rule reuses validate.js.
- No new action type; reducer and state shape untouched (schemaVersion stays 1); LOAD_PLAN's
  case is unchanged and is only ever dispatched with a validated payload.
- Export downloads a self-identifying { app, schemaVersion, exportedAt, plan } .json; import
  validates and, on success, replaces the board via loadPlan; on failure shows a clear error and
  leaves the board untouched (verified in the browser, R3).
- loadOrInit validates the restore, tolerates a legacy bare save and the new { savedAt, plan }
  envelope, and falls back to a fresh plan on structural invalidity; the autosave subscriber
  writes the envelope with savedAt stamped at the boundary; lastReturnedStoryIds normalises to []
  on every load (R6). The clobber limitation is recorded in the log (R5).
- NEW_PLAN remains dormant; no unguarded destructive path ships.
- Verified in the browser against P0 #7 (export/import half) and Screen 5 ruling G8, zero console
  errors.
- I can explain every line. Build-log entry drafted (AI drafts, I sign off).

Start by PROPOSING: the module home and names for validatePlan / migratePlan / exportPlan /
extractPlan (and whether to split from validate.js); the migratePlan version-dispatch seam shape;
the single extractPlan with its file-vs-restore leniency split; the savedAt and exportedAt
boundary stamping (kept out of state); the download filename scheme and the file read/parse
mechanism; the top-bar Save / load control markup and placement in index.html; and the loader's
three-form tolerance plus the recorded clobber limitation. No feature code yet.
