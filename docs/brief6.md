BRIEF 6: Resume / New-plan prompt, Screen 3 (P0 #7, slice 2 of 2)

Read first: docs/sprintplan-mvp-spec.md (v0.5: P0 #7, and the "zero data-loss bugs" quality
bar this slice finishes defending), docs/v1-screen-designs.md (v1.0: Screen 3 "Resume / New
plan prompt", G6 plan title, G8 keeping board-file/report-export/New-plan on separate controls,
and the cross-cutting Autosave + no-silent-resume rules), docs/user-journeys.md (v1.0: Journey
6 sign-off "no silent resume, so last quarter's plan never opens unannounced on a shared
screen", and Journey 1 first-run "instant board with editable defaults"), docs/aide-rules-of-
engagement.md, and docs/build-state-after-brief5.md (what the code actually is now, not just what
the specs say). RoE cadence applies: PROPOSE before you build. No feature code until I approve
the approach. Feature branch per brief (e.g. brief-6-resume-prompt). Branch off main.

PRECONDITION (branch model): Brief 5 (brief-5-board-file-io) must MERGE to main first. main is
still at briefs 1 to 4 (0fdbeb6); Brief 5 is pushed with its PR pending the director's call.
Brief 6 branches off main AFTER Brief 5 lands, so it inherits plan-io.js, the { savedAt, plan }
envelope, and the export/import glue it reuses. Do not stack on the Brief 5 branch.

GOAL
End silent restore and make starting fresh safe. This is the slice that makes resume HONEST. P0
#7 is "local persistence plus file export/import"; Brief 5 shipped autosave, the validated file
half, and the { savedAt, plan } envelope. Brief 6 spends that foundation: on opening with a
saved board present, show the Resume / New-plan prompt (Screen 3) instead of restoring silently,
wire the dormant NEW_PLAN as the app's one destructive path with its download-first escape
hatch, and close the Brief 5 R5 clobber by giving an unreadable save a visible home instead of
silently dropping it. Almost no new pure code: the safety core already exists. This brief is
mostly the prompt view plus a bootstrap restructure over Brief 5's core.

This is slice 2 of 2 for P0 #7. After it, persistence and portability are complete and the next
heavy slice is Brief 7 (dependencies, P0 #5, the first schema change since Brief 2).

WHAT THIS SLICE EXTENDS (from build-state-after-brief5.md and the live source, confirmed)
Brief 5 left every piece this brief needs already built and dormant or unread:
- main.js loadOrInit() restores the saved board AUTOMATICALLY today: it reads the storage key,
  runs extractPlan("restore") then migratePlan then validatePlan, and on success returns the
  plan straight into createStore(); on any structural failure it returns a fresh plan. The store
  is created from this and painted immediately. There is NO prompt. THIS is the silent restore
  this brief ends, and the silent-discard-on-invalid (the clobber) this brief closes.
- The { savedAt, plan } autosave envelope is WRITTEN on every action (main.js subscriber stamps
  savedAt via nowISO() at the serialize boundary) but nothing READS savedAt. Brief 6's "Last
  edited" line reads it for free. No storage-format change needed.
- validatePlan / migratePlan / extractPlan (plan-io.js, pure, tested) already DECIDE whether a
  save is resumable. Brief 6 decides what to DO with each verdict (resume it, or surface it).
- NEW_PLAN is dormant scaffolding: the creator newPlan(startDate) exists (actions.js) and the
  reducer case returns createInitialState(action.payload) (store.js). It has never been
  dispatched. Brief 5 kept it dormant on purpose: a bare New-plan button is an unguarded data-
  loss path, and its escape hatch lives in THIS prompt. Brief 6 activates it.
- LOAD_PLAN is already wired and validated (Brief 5 import path): loadPlan(state) dispatches a
  pre-validated plan; the reducer case is trivial (return action.payload). Resume and Import
  both reuse it. No reducer change.
- The export glue exists as an INLINE click handler on #tb-export (main.js): exportPlan(state,
  nowISO()) then Blob then a temporary <a download> then revoke, with a slugify() filename
  helper. The escape hatch reuses this, so it must be extracted into a named, reusable function
  (a flagged refactor, see WIRING; no silent refactor per RoE).
- The hidden #board-file input plus the atomic import pipeline exist (Brief 5). The prompt's
  "Import a board" link reuses the same input and pipeline, dispatching loadPlan on success.
- Derived data for the summary line is all present: settings.durationMonths, sprints.length,
  Object.keys(stories).length, and placed points via the existing sprintPlacedPoints(state, i)
  selector (board-selectors.js) summed across sprints. Screen 3's line is "stories" (all
  stories) and "pts placed" (placed only, backlog excluded).
- modal.js is a reusable shell (overlay, Escape, overlay-click, dirty guard). The prompt is
  modal-shaped but has DIFFERENT close semantics (dismiss resumes; it is not a dirty-guarded
  form), so reuse-vs-dedicated is a PROPOSE call.

This brief adds NO new action type and changes the state shape NOT AT ALL (schemaVersion stays
1). It activates NEW_PLAN, restructures the bootstrap so restore is a prompted dispatch rather
than a boot-time substitution, and adds the prompt view plus at most two small pure helpers
(summary, relative time). The dependencies schema bump stays in Brief 7.

THE STATE THAT DRIVES THIS BRIEF (read before the rulings)
There are THREE load outcomes today and the loader collapses two of them unsafely. No save is
fine (fresh board). A valid save is restored SILENTLY (the journey forbids this: last quarter's
plan must not open unannounced on a shared screen). An invalid save is silently DISCARDED and
then overwritten by the next action's autosave (the Brief 5 R5 clobber: the bytes are lost with
no notice). So the spine of this brief is: the store always BOOTS FRESH, and a saved board is
restored only by an explicit, PROMPTED dispatch. That single move ends silent restore, removes
the last-quarter render leak, and (because a fresh boot never autosaves until the user acts)
keeps the saved bytes safe under the prompt so an invalid save can be rescued instead of clobbered.

RULINGS BAKED INTO THIS BRIEF (director-ruled R1 to R7, do not silently change)
These were closed in the authoring review. They are decisions, not open questions. The
mechanism details under each are PROPOSE items.

- R1 NO SILENT RESTORE; THE PROMPT IS THE LOAD-TIME GATE FOR A SAVED BOARD. When a saved board
  exists in local storage, the Resume / New-plan prompt renders on load; the board is never
  silently restored (Journey 6 sign-off, Screen 3). When NO save exists, the board renders
  instantly with editable defaults and NO prompt (Journey 1 first-run). The prompt is a load-
  time gate only; it is not a mid-session control.

- R2 THE STORE ALWAYS BOOTS FRESH; RESTORE IS A PROMPTED DISPATCH. This is the load-bearing
  call. createStore is always seeded with createInitialState(nextMonday(todayISO())), even when
  a resumable save exists. Resume then dispatches loadPlan(savedPlan); it does not pre-seed the
  store. Two consequences fall out for free: the saved board never renders under the prompt (no
  last-quarter flash on the shared screen, closing the journey requirement at the render level),
  and autosave (which only fires on dispatch) cannot overwrite the saved bytes until the user
  chooses, which is what makes R5's rescue possible. loadOrInit's job shrinks to CLASSIFYING the
  save (none / valid / invalid-with-reason / raw-string) and handing the prompt its data; it no
  longer substitutes the restored plan at boot.

- R3 NEW_PLAN IS ACTIVATED HERE; IT IS THE APP'S ONLY DESTRUCTIVE PATH AND SHIPS WITH ITS ESCAPE
  HATCH. "Start new plan" warns it replaces the saved board and offers "Download current board
  first (.json)" inline, reusing Brief 5's export glue on the SAVED plan (the one about to be
  discarded). Only then does it dispatch newPlan(nextMonday(todayISO())). That dispatch autosaves
  the fresh plan immediately, so the discard is real and refresh-safe (a refresh does not re-show
  the old board's prompt). No unguarded New-plan affordance ships anywhere (G8: never on the
  save/load control).

- R4 START-NEW IS LOAD-TIME-PROMPT-ONLY IN v1. There is no persistent New-plan button on the
  board (G8; Screen 3 "shown only when a saved board exists"). A mid-session start-new control
  is deferred, which keeps NEW_PLAN's single guarded entry point clean. If you want a persistent
  guarded New-plan control as well, say so; I recommend deferring it to keep one destructive
  entry point in v1.

- R5 AN INVALID SAVE IS SURFACED AND RESCUABLE, NOT SILENTLY DROPPED (the clobber close). When
  the saved board fails extract/migrate/validate, the prompt shows a "could not read your saved
  board" variant: NO Resume option, Start-new and Import offered, plus "Download the unreadable
  save (.json)" to rescue the raw bytes. The human-readable failure reason (the plan-io result's
  reason string) is shown so the facilitator knows why. Because the store booted fresh and has
  not autosaved (R2), the bad bytes are intact until the user acts, so the rescue is always
  available first. This is the actual close of the Brief 5 R5 clobber. Flagged hardest: the
  rescue download is the recommended STRONG form; the weak form (inform-only, no rescue) still
  loses the bytes on the next action, so I recommend the rescue. See THE SUBTLE CALL.

- R6 THE PROMPT READS, NEVER WRITES, AND DISPATCHES ONLY EXISTING ACTIONS. Resume dispatches
  loadPlan; Start-new dispatches newPlan; Import dispatches loadPlan via the Brief 5 pipeline.
  The prompt is pure view over derived data (the summary line, the relative time); it never
  mutates state directly. No new action type. The 15-action vocabulary is unchanged. The state
  shape is unchanged (schemaVersion stays 1). Export and the rescue download read state/bytes;
  they never write state.

- R7 savedAt IS THE "LAST EDITED" SOURCE; relativeTime IS PURE. The resume card reads savedAt
  from the { savedAt, plan } restore envelope (already written in Brief 5) for "Last edited
  [relative time]". relativeTime(fromISO, nowISO) takes "now" as an ARGUMENT so it stays clock-
  free and unit-testable, the same discipline as exportPlan taking exportedAt. A legacy bare
  save (pre-Brief-5, no savedAt) shows "Last edited: unknown" gracefully rather than crashing.

THE SUBTLE CALL (flag hardest here): THE BOOTSTRAP RESTRUCTURE AND THE INVALID-SAVE RESCUE
The whole brief turns on one restructure: stop substituting the restored plan at boot, and make
restore a prompted dispatch over an always-fresh store (R2). Get it wrong in either direction and
a safety property breaks:
- If you seed the store with the SAVED plan and prompt over it, last quarter's board renders
  behind the overlay (the leak Journey 6 forbids) and, worse, any early dispatch autosaves over
  the saved bytes before the user has chosen.
- If you seed fresh but autosave fires before the user chooses (e.g. an eager save on boot), the
  invalid bytes are clobbered before the rescue can be offered, and R5 cannot hold.
The safe shape: boot fresh, paint the empty board under the overlay, do not dispatch anything
until the user picks Resume / Start-new / Import. Resume dispatches loadPlan(savedPlan);
Start-new (after optional download) dispatches newPlan; Import runs the existing pipeline. Until
then, the saved bytes in local storage are untouched, which is exactly what lets an invalid save
be rescued.
On the invalid branch specifically: PROPOSE whether the rescue download serialises the RAW
stored string verbatim (truest rescue, preserves whatever the user or a future migrator might
recover) or the parsed-then-reserialised object. I recommend RAW verbatim: a structurally-broken
but parseable object should be handed back exactly as stored, not lossily reformatted. Also
PROPOSE the Escape/dismiss semantics: on the VALID prompt, Escape/overlay-click RESUMES (Screen 3
"Escape/dismiss resumes"); on the INVALID prompt there is nothing to resume, so Escape/overlay-
click is INERT (the user must pick Start-new, Import, or Download-rescue), so a stray Escape can
never drop the rescuable bytes. I recommend that split.

ARCHITECTURE CONSTRAINT (non-negotiable, RoE quality gate)
- Any new pure helpers (the summary selector, the relative-time formatter) are PURE, DOM-free,
  and unit-tested BEFORE the prompt DOM or the bootstrap wiring, the same pattern Brief 1 used
  for capacity maths and Brief 5 for the I/O core. relativeTime takes "now" as an argument so it
  is clock-free and testable. The prompt DOM and the bootstrap wiring are browser-verified, not
  unit-tested, the same way Brief 3 kept the drag gesture and Brief 5 kept the Blob/file glue
  out of the unit net.
- No new clock read enters the store. todayISO and nowISO stay the only two boundary clock reads
  in main.js. savedAt is already written by Brief 5; relativeTime consumes nowISO() passed in.
- The view never mutates state. The prompt dispatches the existing loadPlan / newPlan actions
  with already-validated or freshly-created payloads. Export and the rescue download read; they
  never write state.
- No new action type. The 15-action vocabulary is unchanged. The state shape is unchanged
  (schemaVersion stays 1). The prompt and its summary are persistence-/view-boundary concerns,
  outside the store.

THE PURE CORE (build and unit-test FIRST, DOM-free; likely two small helpers, maybe one)
PROPOSE the module homes and exact names; keep the module count down (reuse an existing file
where it fits).
- planSummary(state) returns the resume card's derived numbers, e.g. { months, sprints, stories,
  placedPoints } where months = settings.durationMonths, sprints = sprints.length, stories =
  Object.keys(stories).length (ALL stories), placedPoints = sum over sprints of
  sprintPlacedPoints(state, i) (PLACED only; backlog excluded). PROPOSE home: board-selectors.js
  (sprint-side derived data already lives there) or a small dedicated file. Reuse
  sprintPlacedPoints; do not re-implement the points sum.
- relativeTime(fromISO, nowISO) returns a human "Last edited" string, e.g. "just now",
  "N minutes ago", "N hours ago", "yesterday", "N days ago", then an absolute date past some
  bound. Pure: "now" is an argument. PROPOSE home (date.js owns calendar string maths and is the
  natural home) and the exact buckets and bound. A missing/invalid fromISO returns "unknown" (the
  legacy-bare-save path), it never throws.
If the team prefers, the summary may be assembled inline from existing selectors and only
relativeTime is extracted; PROPOSE which, but anything with branching logic (relativeTime's
buckets, the legacy fallback) must be unit-tested, not eyeballed.

WIRING (end silent restore; activate NEW_PLAN; reuse the Brief 5 glue)
- Bootstrap restructure (main.js): seed the store with a fresh plan ALWAYS (R2). Replace
  loadOrInit's "return the restored plan" with a CLASSIFY step that reads the raw stored string
  and returns one of: none; valid (with the validated plan and savedAt); invalid (with the
  failure reason and the raw string for rescue). Wire autosave/paint/listeners exactly as today,
  paint the fresh board, then: if none, do nothing more (first run); if valid or invalid, open
  the prompt. Keep the existing fresh-plan fallback behaviour intact for the no-save path.
- Extract the export glue into a named, reusable function (flagged refactor, not silent):
  downloadBoard(state) wrapping exportPlan(state, nowISO()) + Blob + <a download> + revoke +
  slugify filename. Re-point the existing #tb-export handler at it AND use it for the Start-new
  escape hatch. Add downloadRaw(text, filename) for the invalid-save rescue (raw string to a
  Blob; PROPOSE the filename, e.g. unreadable-board-<date>.json). These are thin browser glue
  over no new logic.
- Resume: dispatch loadPlan(normalise(savedPlan)) (normalise resets lastReturnedStoryIds per
  Brief 5 R6, so no stale toast), close the prompt.
- Start new: optionally downloadBoard(savedPlan) (the escape hatch), then dispatch
  newPlan(nextMonday(todayISO())) (autosaves the fresh plan immediately), close the prompt.
- Import: trigger the existing hidden #board-file input and reuse the Brief 5 atomic pipeline; on
  a successful loadPlan, close the prompt; on failure, the existing non-blocking error shows and
  the prompt stays.
- Invalid-save rescue: "Download the unreadable save (.json)" calls downloadRaw(rawString, ...);
  the prompt stays until the user starts-new or imports (which dispatch and only then overwrite
  the bad bytes).

UI (Screen 3 only: the Resume / New-plan prompt)
- VALID save (the resume card is primary, the default action):
  - Plan title (G6) or "Untitled plan".
  - "Last edited [relative time]" from savedAt (R7).
  - Summary line in mono: "3 months · 6 sprints · 14 stories · 47 pts placed" from planSummary.
  - Start new plan (secondary): warns it replaces the saved board; "Download current board first
    (.json)" inline (R3); the destructive control uses the danger-ghost treatment consistent with
    the card editor's Delete (modal.js uses btn-danger).
  - Import a board (.json): tertiary text link (reuses #board-file).
  - Escape/overlay-click RESUMES (the safe, non-destructive default).
- INVALID save (R5 variant):
  - Heading e.g. "We could not read your saved board" plus the human-readable reason.
  - NO Resume option. Start new plan and Import offered. "Download the unreadable save (.json)"
    to rescue the raw bytes.
  - Escape/overlay-click is INERT (nothing to resume; do not drop the rescuable bytes).
- Branding: instrument-core tokens, data-app="plan", plum accent for the primary action and
  focus rings, IBM Plex Mono for the numbers, the relative time, and the summary line. The
  destructive Start-new uses danger-ghost. No capacity colours anywhere on the prompt (amber/red
  mean capacity and nothing else). Minimum 13px body, mono numbers 12px+.

OUT OF SCOPE (parking lot; do not "while we're here" these, RoE anti-pattern)
- Dependencies (P0 #5), now Brief 7. The schemaVersion bump, the v1-to-v2 migrator
  (migrators[1]), the LINK_DEP action, the picker, the SVG connector layer, and violation borders
  all land there. This brief touches NO schema and adds NO migrator; the seam built in Brief 5
  stays empty.
- Report export in any format (P0 #6). Separate brief, separate control (G8). The prompt's
  download affordances are BOARD FILE only.
- A persistent or mid-session New-plan control (R4 defers it). v1 has exactly one destructive
  entry point: the load-time prompt.
- Multiple boards / multiple saved plans (P2). v1 has exactly one storage key.
- Stretch toggle, labels, parked lane, stats strip (P1). Sub-1280px backlog drawer; dark mode.

ASSERTED CASES (assert these exact outcomes; derive the rest; tests assert real values)
Build fixtures as real plan states (a fresh default plan, and a plan with placed stories). For
planSummary:
1. FRESH DEFAULT PLAN. planSummary(createInitialState(...)) = { months: 3, sprints: 7, stories:
   0, placedPoints: 0 } (the 3-month/2-week default generates 7 sprints, per Brief 1's worked
   cases). Confirm the sprint count against generateSprints rather than hard-trusting 7.
2. REAL PLACED PLAN. A plan with, e.g., an 8-pt and a 5-pt story placed in two sprints and a
   3-pt story left in backlog: stories = 3 (all), placedPoints = 13 (placed only, backlog
   excluded). Pin both figures to real values so "stories" can never silently become a placed-
   only count or placedPoints silently include the backlog.
3. ONE-MONTH PLAN. A 1-month plan gives months: 1, sprints: 3 (per Brief 1's worked cases),
   exercising the settings-vs-sprints distinction.
For relativeTime (fixed now, real strings):
4. SAME INSTANT. relativeTime(now, now) = "just now".
5. MINUTES. ~45 minutes before now reads in minutes (assert the exact string your buckets
   produce, e.g. "45 minutes ago").
6. HOURS. ~3 hours before reads in hours.
7. YESTERDAY. The previous calendar day reads "yesterday".
8. DAYS. ~5 days before reads in days.
9. LEGACY / MISSING. relativeTime(undefined or "", now) = "unknown" (the no-savedAt path), no
   throw. Pin whatever bucket boundaries you choose with cases either side so a future off-by-one
   in the thresholds fails the unit net.
Browser-verified, not unit cases:
- NO SAVE: a cleared local storage boots straight to a fresh board with NO prompt (first run).
- VALID SAVE, RESUME: with a saved board present, the prompt shows; the saved board does NOT
  render under the overlay (no last-quarter flash); Resume loads it and the board matches.
- VALID SAVE, START-NEW: "Download current board first" downloads the saved board, then the board
  is fresh and the save is overwritten (a refresh shows the fresh board's own prompt, not the old
  board's).
- VALID SAVE, IMPORT: the tertiary Import link loads a chosen file via the Brief 5 pipeline and
  closes the prompt.
- INVALID SAVE: hand-corrupt the stored value to a parseable-but-invalid plan; the prompt shows
  the "could not read" variant with the reason; "Download the unreadable save" downloads the raw
  bytes; the bad bytes are NOT overwritten until the user starts-new or imports; no console
  error, no crash.
- ESCAPE: Escape on the valid prompt resumes; Escape on the invalid prompt is inert.

HOUSEKEEPING (carry-forward, still NOT actioned this brief; record as remaining open)
- Theme-token promotion still open: promote --plum / --plumwash, #glyph-plan, and the 8 epic-
  palette tokens to the shared instrument-core source; register plan as a SURFACE in the theme
  manifest.mjs and add the check-theme-drift test. Suite-level, out of scope for a feature brief.
- Dragula vendoring decision stands (docs/housekeeping-dragula-vendoring.md): keep per-app
  copies; no cross-repo move. No action.

BRANDING
instrument-core tokens, data-app="plan". The prompt uses standard modal/overlay chrome, plum
accent for the primary action and focus rings, danger-ghost for the destructive Start-new, IBM
Plex Mono for every number, the relative time, and the summary line. No capacity colours on the
prompt. Minimum 13px body, mono numbers 12px+.

DEFINITION OF DONE
- planSummary and relativeTime (whichever are extracted) have passing unit tests asserting the
  cases above with real values, including the placed-vs-all distinction (case 2), the settings-
  vs-sprints distinction (cases 1, 3), and the legacy/missing relative-time path (case 9). The
  summary reuses sprintPlacedPoints; relativeTime is clock-free (now passed in).
- No new action type; reducer and state shape untouched (schemaVersion stays 1); LOAD_PLAN's and
  NEW_PLAN's reducer cases are unchanged and are each only ever dispatched with a valid payload.
- The store boots fresh ALWAYS; restore is a prompted loadPlan dispatch (R2). Silent restore is
  gone: a saved board shows the prompt; no save boots straight to a fresh board.
- NEW_PLAN is activated and is the only destructive path, shipping with its download-first escape
  hatch; it autosaves the fresh plan immediately so the discard is real. No unguarded destructive
  affordance ships (G8).
- An invalid save is surfaced in the prompt with its reason and a raw-bytes rescue download, and
  is NOT overwritten until the user acts (R5). The Brief 5 R5 clobber is CLOSED; update the build
  log's known-limitation note to record the close.
- The resume card reads savedAt for "Last edited [relative time]"; a legacy bare save shows
  "unknown" gracefully (R7).
- Verified in the browser against Screen 3 and Journey 6 (and Journey 1 first-run), zero console
  errors.
- I can explain every line. Build-log entry drafted (AI drafts, I sign off).

Start by PROPOSING: the bootstrap restructure (boot-fresh + classify none/valid/invalid/raw +
prompt-on-load) and how loadOrInit's signature changes; whether to reuse modal.js or build a
dedicated prompt shell, and the Escape semantics split (resume on valid, inert on invalid); the
module homes and exact names for planSummary and relativeTime (and whether the summary is
extracted or assembled inline); the relativeTime buckets, bound, and "unknown" fallback; the
extraction of downloadBoard(state) and downloadRaw(text, filename) from the inline #tb-export
handler (the flagged refactor) and the rescue filename; the raw-vs-reserialised choice for the
invalid-save rescue; and the prompt markup for both the valid resume card and the invalid
variant. No feature code yet.
