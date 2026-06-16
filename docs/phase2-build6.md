> **Correction (16 Jun 2026, post-build):** the shared `storyCard` renderer lives in `public/js/backlog.js`, NOT `render.js` as the "Read first" and Files lists below state. The chip + toggle shipped in `backlog.js`; `render.js` needed no change. The reducer also guards an unknown id (`if (!(id in state.stories)) return state`) beyond the literal snippet below, so a stretch mark on an unknown id is a safe no-op rather than a phantom story. See `build-log.md` (2026-06-16) and `build-state-after-phase2-build6.md`. The brief is otherwise source-accurate.

BRIEF phase2-build6: story-level "stretch" toggle (P1)

Sixth post-launch build, the second net-new direction since the UAT backlog cleared
(build-state-after-phase2-build5.md: no queued cluster). Director's pick from the next-work
review: the P1 "stretch" toggle. A facilitator can mark a placed story as a stretch goal; the
story stays fully counted in the sprint total and pill, and is listed separately in the export,
so the over-commitment is on the record and the rationalisation is visible.

This is the deliberate inverse of build5. Build5 held the sealed model (no action, no schema,
no op). build6 is the FIRST intentional schema-and-op extension since the dependency work
(briefs 7 and 8). It goes through the established seams (migratePlan, the allow-list) under the
PROPOSE gate, and it does NOT touch the capacity maths. That last point is the line this build
holds (R1).

RoE cadence applies. PROPOSE was ruled in chat (David: "happy", accepted all recommendations);
the ruled block is at the foot of this brief for the record. TDD where there is pure logic;
local-mode manual check plus a two-browser room check for the synced op. NO code before the
rulings below; they are settled.

The framing (why it earns its place): the app's whole point of view is honesty about
over-commitment. The Brief 4 banner already warns "relabelling it a stretch goal does not add
capacity." This feature lets a facilitator record which stories are the stretch ones WITHOUT
letting that relabelling reduce the load: stretch points still count, the pill colour does not
move, and the export shows the full overage alongside how much of it is stretch. The feature
and the banner reinforce each other.

Read first (live source, not this summary):
- public/js/store.js — the Story typedef ({ id, title, summary, points, epicId }); createInitialState
  (meta.schemaVersion is 2, bumps to 3 this build); the reducer switch. NOTE: EDIT_STORY does
  `{ ...state.stories[id], title, summary, points, epicId }`, i.e. it spreads the existing story
  first, so a `stretch` field survives a field edit untouched. Add the SET_STORY_STRETCH case here.
- public/js/actions.js — ActionTypes (17 today) and the creators. Add SET_STORY_STRETCH + setStoryStretch.
- public/js/plan-io.js — CURRENT_SCHEMA (2 today, → 3); MIGRATORS (has [1]: v1→v2 adding deps:[]);
  migratePlan; validatePlan. validatePlan does NOT change (R2). Add MIGRATORS[2].
- server/rooms.js — applyOp + the ALLOWED set (10 ops today; the doc-comments still say "9 wire
  ops" in two places). Add SET_STORY_STRETCH (→ 11) and fix BOTH stale comments while here (R3).
- public/js/board-selectors.js + public/js/plan-maths.js — the capacity authorities (placedPoints,
  sprintPlacedPoints, sprintCapacity, pillState, overBy). CONFIRM these stay byte-for-byte untouched:
  placedPoints sums the points of every placed story; stretch must never subtract (R1, the invariant).
- public/js/render.js — the shared storyCard renderer; it already branches on the `placed` flag for
  the board-only return-to-backlog control (#9) and the D-badge. The stretch chip and the in-place
  toggle go on that same placed branch (R4/R5).
- public/js/main.js — the #board delegated click listener (switch on data-act: edit-story /
  dismiss-banner / return-to-backlog). Add a toggle-stretch branch. Works in BOTH local and room
  mode (stretch is a real action, not an ephemeral side-channel — unlike build5 cursors).
- public/js/drag.js — it already excludes the #9 return-to-backlog control as a drag handle. Add the
  stretch toggle to the same exclusion so tapping it never starts a drag.
- public/js/report.js — reportModel (StoryRow, SprintBlock, overCommitment) and the three renderers
  (toMarkdown / toHtml / toCsv). Add the stretch dimension (R6).
- public/js/sync-client.js — CONFIRM no change needed: dispatch sends `{ type, payload }` whole for
  every action except the EDIT_STORY field-delta, so a whole-payload SET_STORY_STRETCH already rides
  the existing transport.

---

THE HEADLINE (the line this build holds)

Marking a story stretch NEVER changes a sprint's placed total or its pill colour, and never
changes the whole-plan capacity bar. Stretch is recorded intent plus a report treatment, not a
capacity discount. The capacity authorities (board-selectors.js, plan-maths.js) are untouched;
the over-commitment section reports the FULL overage and merely annotates how much of it is
stretch. This is the literal enforcement of the Brief 4 banner.

This build DOES change the model (deliberately, under the gate): a new optional story field, a
schema bump v2 → v3 through migratePlan, a new SET_STORY_STRETCH action, and one allow-list
entry. It is additive, it loses no data, and an existing v2 save migrates cleanly on load.

---

GOAL

A facilitator can mark a placed story as a stretch goal with one tap on the card, see it tagged,
and find it called out in the export, while the sprint's capacity status is completely unmoved by
the act of marking it.

---

RULINGS (settled architecture — not up for PROPOSE)

- R1 THE HONESTY INVARIANT — THE HARD ONE. Stretch never alters capacity. placedPoints,
  sprintPlacedPoints, sprintCapacity, pillState, overBy, planCapacity, and planBarData are
  untouched; stretch stories stay counted in full. Asserted test: take a state with a placed
  story, dispatch SET_STORY_STRETCH true, and sprintPlacedPoints(i) and pillState are byte-identical
  before and after. board-selectors.js and plan-maths.js are byte-for-byte unchanged.
- R2 DATA SHAPE + SCHEMA, NO NEW LOAD-BOUNDARY GATE. `stretch` is an optional boolean on the story
  (stories[id].stretch); absent reads as false. Schema bumps v2 → v3 through the existing seam:
  CURRENT_SCHEMA = 3, MIGRATORS[2] = (plan) => ({ ...plan, meta: { ...plan.meta, schemaVersion: 3 } })
  (version bump only, no per-story backfill), createInitialState stamps schemaVersion 3. validatePlan
  does NOT gain a stretch check: stretch is a non-structural scalar that can neither dangle a
  reference nor lose data, so the load boundary stays focused on conservation and reference
  invariants as it is today. An existing v2 localStorage save or exported file MUST migrate and load
  with zero data loss (the project's hardest bar).
- R3 ACTION + ALLOW-LIST. New SET_STORY_STRETCH { id, stretch } — an explicit boolean, not a flip,
  so concurrent room edits are last-write-wins clean. Reducer writes stretch onto the story and
  preserves every other field. Add SET_STORY_STRETCH to ALLOWED in rooms.js (the set becomes 11
  ops); it is a server-DATA op (changes room.doc), whole-payload, conflict-free. While rooms.js is
  open, correct BOTH stale "9 wire ops" doc-comments to "11 wire ops" (the build-state review nit).
  sync-client.js needs no change (whole-payload actions already ride dispatch).
- R4 UX SURFACE — IN-PLACE ON PLACED CARDS. The toggle is an in-place control on placed cards
  (board side), live-committing via SET_STORY_STRETCH, exactly the pattern of the #9
  return-to-backlog control: rendered on the placed branch of storyCard, dispatched from the #board
  delegated listener (a new toggle-stretch data-act), and excluded as a drag handle in drag.js. It
  is NOT in the card editor and NOT on backlog cards, so stretch is naturally constrained to placed
  stories. The flag persists as data if a stretch story is later moved to the backlog, but renders
  nothing there (no data loss, no surprise clearing). Works in local and room mode.
- R5 VISUAL — NEUTRAL, NEVER A CAPACITY OR INTERACTION COLOUR. A muted "stretch" chip on placed
  stretch cards (var(--soft) on var(--bone) vocabulary). Never amber or red (those mean capacity and
  the dependency violation), never plum-as-status (plum is the interaction accent and the D-badge).
  The chip reads only when placed.
- R6 REPORT. StoryRow gains `stretch: boolean`. CSV gets a new `stretch` column (per-story truth;
  backlog rows blank). Each over-commitment entry shows the FULL overBy and "of which M pts marked
  stretch" (stretchPoints = sum of points of placed stretch stories in that sprint), so the overage
  stays fully on record while the stretch intent is visible. Per-sprint story tables (md and html)
  mark stretch rows. Every figure still flows from the existing authorities (the report can never
  disagree with the board).
- R7 SCOPE. One slice, one feature branch, one PR; brief phase2-build6.md.

---

WHAT THIS BUILD BUILDS (per item)

### Schema + action (the model extension)

Today: the story is { id, title, summary, points, epicId }; schemaVersion is 2; MIGRATORS has only
[1] (v1→v2 adding deps:[]); the reducer has 17 actions; the allow-list is 10 ops.

Build:
- store.js: createInitialState stamps meta.schemaVersion 3. New reducer case SET_STORY_STRETCH:
  `{ ...state, stories: { ...state.stories, [id]: { ...state.stories[id], stretch } }, lastReturnedStoryIds: [] }`.
- actions.js: ActionTypes.SET_STORY_STRETCH; setStoryStretch({ id, stretch }) -> { type, payload: { id, stretch } }.
- plan-io.js: CURRENT_SCHEMA = 3; MIGRATORS[2] = version-bump-only (absent stretch reads false);
  validatePlan unchanged.
- rooms.js: ALLOWED += SET_STORY_STRETCH (11 ops); fix both "9 wire ops" comments to "11 wire ops".

### Capacity maths (the invariant: nothing changes)

board-selectors.js and plan-maths.js are untouched. placedPoints keeps summing the points of every
placed story including stretch; pillState and the plan-capacity bar are unmoved. This is asserted,
not assumed (see ASSERTED OUTCOMES).

### The in-place toggle + the chip

Today: storyCard renders the card for board and backlog; the placed branch already carries the
return-to-backlog control and the D-badge; the #board listener handles edit-story / dismiss-banner /
return-to-backlog; drag.js excludes the return-to-backlog control as a handle.

Build:
- render.js: on the placed branch of storyCard, render (a) a muted "stretch" chip when story.stretch
  is true, and (b) an in-place toggle control with a data-act of "toggle-stretch" and the story id.
- main.js: a toggle-stretch branch in the #board delegated listener that dispatches
  setStoryStretch({ id, stretch: !current }) from the latest state. Local and room.
- drag.js: add the toggle control to the excluded-handle set, alongside the return-to-backlog control.
- plan.css: the .bl-story stretch chip + toggle affordance, neutral tones only (R5).

### The report

Build:
- report.js: StoryRow.stretch (from stories[id].stretch ?? false); SprintBlock/overCommitment gain
  stretchPoints; toCsv adds the stretch column; toMarkdown and toHtml add the over-commitment split
  and a per-sprint stretch marker. Empty/zero cases read naturally (no stretch = no annotation).

---

ASSERTED OUTCOMES (TDD where there is logic; manual for view/CSS)

Unit — schema + migration (plan-io test, RED first):
- migratePlan: a v2 plan migrates to v3 with deps and stories preserved and meta.schemaVersion 3
  stamped; a v3 plan round-trips unchanged; a v4 (newer) plan still fails clearly.
- A v2 plan with NO stretch fields loads through extract -> migrate -> validate and every story
  reads stretch as false (absent = false). Data-continuity: a stored v2 { savedAt, plan } envelope
  classifies as valid and resumes with zero data loss after the bump.
- validatePlan: a plan with stretch booleans on some stories validates; a plan with no stretch
  fields validates (no new rejection path).

Unit — action + reducer (store test, RED first):
- SET_STORY_STRETCH true sets stories[id].stretch true and leaves title/summary/points/epicId and
  every other story untouched; SET_STORY_STRETCH false clears it.
- An EDIT_STORY after a stretch mark preserves stretch (the reducer spreads the existing story).
- An unknown id is a safe no-op (pure, returns state effectively unchanged for that story).

Unit — the honesty invariant (the hard one, R1):
- Given a sprint with placed stories, dispatch SET_STORY_STRETCH true on one of them:
  sprintPlacedPoints(i) is identical before and after, and pillState(placed, capacity) is identical.
  planBarData.tone and planBarData.planned are identical. (Stretch never discounts capacity.)

Unit — report (report test, RED first):
- reportModel: storyRow.stretch reflects the story; a sprint's overCommitment entry carries
  stretchPoints = sum of its placed stretch stories' points, while overBy is the full overage.
- toCsv: the header has a `stretch` column; a placed stretch story's row reads "yes", a non-stretch
  row blank, a backlog row blank.
- toMarkdown / toHtml: an over sprint shows the full "over by N" AND the "of which M pts marked
  stretch" annotation; stretch stories are marked in the per-sprint listing; a plan with no stretch
  reads exactly as today (no spurious annotations).

Room sync (mirrors phase2-build1-deps-room-sync):
- applyOp accepts SET_STORY_STRETCH, applies it via the existing reducer + validatePlan, commits, and
  broadcasts the op; ALLOWED contains SET_STORY_STRETCH (the set is 11).

Manual — local mode (the primary surface, no room needed):
- Place a story in a sprint, tap the stretch toggle: the chip appears, the sprint pill colour and
  total do NOT change, the plan-capacity bar does NOT move.
- Export CSV/markdown/HTML: the story is flagged stretch; an over sprint shows the full overage and
  the stretch split.
- Tap again: the chip clears. Move a stretch story to the backlog: no chip there; move it back: the
  chip returns (the flag persisted). Refresh: the stretch state survives (autosave v3). Load an
  older v2 board file/save: it resumes cleanly with no stretch flags and no data loss.

Manual — two-browser room (the synced op): mark a story stretch in Alice's window; the chip and the
report treatment appear for Bob; the pill colour is unmoved for both.

Regression: full suite + typecheck + drift green; the local resume/restore path (Brief 6) and the
MP1 sync path re-verified, since this build touches the schema and adds a room op.

---

OUT OF SCOPE (parking lot — kept to one slice on the director's call)

- Gating the toggle on capacity state (only showing it on over-capacity sprints). The control is
  available on any placed story; the over-commitment section is where stretch earns its keep.
- A stretch toggle in the card editor, or stretch on backlog cards.
- Any change to the capacity maths, the pill, the banner, or the banner copy.
- A "promote stretch to committed" bulk action, stretch counts in the plan-capacity bar label, or a
  stretch filter/view.
- Any validatePlan gate on stretch (it is non-structural; R2).

---

DEFINITION OF DONE

- The stretch toggle works in local mode against the asserted outcomes, INCLUDING the invariant that
  marking stretch never moves a pill, a sprint total, or the plan-capacity bar; and INCLUDING the
  data-continuity check that an existing v2 save loads as v3 with zero data loss.
- The synced op verified in a two-browser room; the pill is unmoved for both participants.
- Pure logic has unit tests that assert real behaviour, RED first (migration, reducer, the honesty
  invariant, the report) — reviewed for what they assert, not just that they pass.
- The model change is deliberate and minimal: one optional field, one migrator step, one action, one
  allow-list entry; board-selectors.js and plan-maths.js untouched; validatePlan unchanged; no data
  loss; an older save migrates cleanly.
- I can explain every line; build-log entry drafted (AI drafts, David signs off).
- Full suite + typecheck + drift green; Brief 6 resume path + MP1 sync path re-verified.

---

START BY (the rulings are settled): write the plan-io migration tests (RED) — migratePlan v2→v3,
absent-stretch-reads-false, the v2-save-loads-as-v3 data-continuity case — then bump CURRENT_SCHEMA /
MIGRATORS[2] / createInitialState. Then the SET_STORY_STRETCH action + reducer case + its reducer
tests (set/clear/preserve, EDIT_STORY-preserves-stretch). Then the honesty-invariant test (RED) and
confirm board-selectors.js / plan-maths.js need no edit. Then rooms.js allow-list + the comment fix +
the room-sync test. Then report.js (storyRow.stretch, stretchPoints, CSV column, the over-commitment
split, per-sprint marker) + report tests. Last, the view: render.js stretch chip + in-place toggle,
main.js toggle-stretch listener branch, drag.js exclusion, plan.css chip + toggle. Verify locally,
then in a two-browser room.

Files (anticipated):
- New: tests for the stretch reducer + the honesty invariant + the room-sync op (e.g.
  tests/store-stretch.test.js and a phase2-build6 room-sync test); additions to tests/plan-io.test.js
  (migration + data-continuity) and tests/report.test.js (stretch column + split).
- Modified: public/js/store.js (createInitialState v3 + SET_STORY_STRETCH case), public/js/actions.js
  (ActionTypes + setStoryStretch), public/js/plan-io.js (CURRENT_SCHEMA 3 + MIGRATORS[2]),
  server/rooms.js (ALLOWED += SET_STORY_STRETCH, "9 wire ops" → "11 wire ops" x2), public/js/report.js
  (stretch dimension), public/js/render.js (stretch chip + toggle on the placed branch),
  public/js/main.js (toggle-stretch listener branch), public/js/drag.js (toggle excluded as a handle),
  public/css/plan.css (neutral stretch chip + toggle).
- Untouched (assert): public/js/board-selectors.js, public/js/plan-maths.js (the R1 invariant),
  public/js/sync-client.js (whole-payload action needs no transport change), public/js/card-editor.js,
  the local single-user PATH mechanics (it gains stretch behaviour but no path change).

---

PROPOSE — RULED IN CHAT (David: "happy", accepted all recommendations; recorded for the build-state)

P1. Data shape. Optional `stretch` boolean on the story (vs a separate stretchIds array). RULED:
    field on the story; survives EDIT_STORY for free (folded into R2).
P2. Schema bump. v2 → v3 via the migratePlan seam, version-bump-only migrator, absent = false.
    RULED: minimal migrator (folded into R2).
P3. validatePlan. No stretch check (non-structural scalar; cannot dangle or lose data). RULED: no
    load-boundary change (folded into R2).
P4. Action + reducer. Dedicated SET_STORY_STRETCH, explicit boolean (LWW-clean in a room). RULED:
    dedicated action (folded into R3).
P5. Room allow-list. Add SET_STORY_STRETCH (→ 11 ops); fix the stale "9 wire ops" comments. RULED:
    yes + comment fix (folded into R3).
P6. Capacity maths. Untouched; stretch stays counted; assert the invariant. RULED: no maths change
    (folded into R1, the headline).
P7. UX surface. In-place toggle on placed cards (the #9 return-to-backlog precedent) vs the card
    editor. RULED: in-place on placed cards (folded into R4).
P8. Visual. Neutral muted chip, placed-only, never amber/red/plum-as-status. RULED: neutral chip
    (folded into R5).
P9. Report. CSV stretch column + over-commitment "of which M stretch" split + per-sprint marker.
    RULED: full treatment (folded into R6).
P10. Scope. One slice, one branch/PR. RULED: one slice (folded into R7).
