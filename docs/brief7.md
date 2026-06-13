BRIEF 7: Dependencies, P0 #5, slice 1 of 2 (data model, picker, and badge)

Read first: docs/sprintplan-mvp-spec.md (v0.5: P0 #5 "Story-to-story dependency link", resolved
decision 6 "stack order is a facilitation signal only; recorded dependencies are the only ordering
truth", and the "zero data-loss bugs" quality bar this slice must not breach), docs/v1-screen-
designs.md (v1.0: Screen 2 "Card editor with dependency picker", ruling G7 "any story pickable
incl. backlog; violations evaluate only when both scheduled; backlog-side pairs neutral", and the
Screen 1 card anatomy that names the badge), docs/user-journeys.md (v1.0: Journey 4 "Mark
dependencies" and the sign-off "dependency control lives in the card editor only; arrows, badges
and tethers render on the board, but the link is created and removed in the card editor"),
docs/aide-rules-of-engagement.md, and docs/build-state-after-brief6.md (what the code actually is
now, not just what the specs say). RoE cadence applies: PROPOSE before you build. No feature code
until I approve the approach. Feature branch per brief (brief-7-dependencies-data). Branch off main.

PRECONDITION (branch model): main carries briefs 1 to 6 (3be133d, Brief 6 merged via PR #4 with
--merge). Brief 7 branches off main. Do not stack on the brief-6-resume-prompt branch. This is the
first brief since Brief 2 to change the state shape, and the first to use the migratePlan seam that
Brief 5 built and left empty.

GOAL
Give the board a dependency data model and let a facilitator create and remove links from the card
editor (Journey 4, Screen 2). This is the heaviest remaining P0 and it splits cleanly, so this is
slice 1 of 2: the DATA plus the PICKER plus the BADGE. After this slice, a facilitator can mark
"this blocks..." or "this needs..." from either story's card editor, both cards show a shared D
badge, the editor lists existing links and flags a violating pair in red at creation time (Screen 2),
and deleting a story or epic removes its links with no dangling references. The board's drawn layer
(cross-sprint connectors, same-sprint tethers, board-side red violation treatment) is slice 2,
Brief 8. The export warnings section is P0 #6, a separate brief; this slice ships the pure violation
selector that both will consume, but wires it only to the editor row.

This brief makes the first schema bump since Brief 2 (v1 to v2), adds the first new action since
Brief 3 (LINK_DEP, plus its removal UNLINK_DEP), extends validatePlan and the deletes to keep
dependency pairs conserved, adds one pure selectors module, and adds the Dependencies section and
picker to the existing card editor. It adds NO drawing layer and NO SVG.

WHY SLICE IT HERE (the cut, and what falls on each side)
The build-state-after-brief6 handoff recommends a split, and the natural seam is data-versus-drawing.
- Slice 1 (this brief): the model (schema, migrator, field shape, validation, actions, delete
  pruning), the pure selectors (location, role, label, violation, pickable targets), the card-editor
  Dependencies section and picker, the neutral D badge on the shared card, and the violation feedback
  INSIDE the editor row. Screen 2 requires the mistake to be "visible at creation time, not only on
  the board", so the violation selector and the editor-row red treatment belong here, with the picker
  that can create the violation.
- Slice 2 (Brief 8): the app's first SVG layer, drawn on the board: cross-sprint connectors on
  hover/select, the always-visible same-sprint tether, and the board-side red treatment on cards and
  connectors when a pair is a violation. No new action, no schema change; a pure view over the slice 1
  model.
This keeps one feature per brief and keeps the SVG, a different discipline, out of the data slice.

WHAT THIS SLICE EXTENDS (from build-state-after-brief6.md and the live source, confirmed)
Everything Brief 7 needs to bump the schema and store a link is already built and waiting:
- plan-io.js has the migrator seam, real and empty: CURRENT_SCHEMA = 1, MIGRATORS = {} (an empty
  object), and migratePlan loops "for (let from = v; from < CURRENT_SCHEMA; from++) migrated =
  MIGRATORS[from](migrated)", a no-op today. It already fails a missing/invalid version and a version
  NEWER than the build ("saved by a newer version of sprintplan"). Brief 7 adds MIGRATORS[1] and bumps
  CURRENT_SCHEMA to 2. This is the seam's intended first use, not a retrofit.
- validatePlan (plan-io.js) is the single load-boundary spine and already enforces conservation:
  every backlog/placed id exists in stories, and no id appears in more than one array. It checks the
  top-level keys meta/settings/epics/stories (objects) and sprints/backlog (arrays), story.epicId is
  null or an existing epic, and points pass isValidPoints. The dependency field extends this same
  pass: it is the right and only place to reject a link to a non-existent story.
- Ids are minted at the action-creator edge (ids.js newId(prefix), e.g. newId("dep")), never in the
  reducer, so the reducer stays pure and tests assert exact state. LINK_DEP follows this rule.
- card-editor.js is stubbed for exactly this: its header reads "Screen 2 minus the dependencies
  section (deferred to the dependencies brief)... The dependencies section is intentionally absent."
  It already builds Title, Epic (with inline new-epic), Points (Fibonacci chips + free entry),
  Summary, a dirty-tracked footer, and commits via ADD_STORY/EDIT_STORY/DELETE_STORY. The Dependencies
  section is added below Summary; the footer and dirty tracking are reused.
- storyCard(story, epic) in backlog.js is the SINGLE shared card renderer, used by both the backlog
  panel (no epic dot) and the board (epic dot prepended). The D badge lands here once and shows in
  both places, exactly as Screen 1 specifies "badges always visible".
- Deletes are atomic today: deleteStory removes the story from the map and from whichever array holds
  it; deleteEpic in "delete" mode removes child stories from the map and all arrays. Brief 7 extends
  both to ALSO drop any dependency pair that references a removed story id (see THE SUBTLE CALL).
- applySettings spreads "...state" then overrides sprints/backlog, and regenerate returns only
  { sprints, backlog, returnedStoryIds }. So a top-level deps array rides through every settings
  regeneration untouched. A duration shrink that returns a placed dependent to the backlog keeps its
  link; the pair simply becomes backlog-side and stops evaluating as a violation (G7). No regenerate
  change is needed, but this must be asserted (zero-data-loss bar, resolved decision 7).
- LOAD_PLAN returns its (already validated) payload, and NEW_PLAN returns createInitialState. Both
  carry the new shape for free once createInitialState seeds deps and the migrator backfills it.

THE STATE THAT DRIVES THIS BRIEF (read before the rulings)
P0 #5 is one link type, stored as a directed pair, creatable from either side. The Jira framing:
"A is blocked by B" is the same fact as "B blocks A". The prerequisite (the thing to do first) is
the BLOCKER; the dependent is the BLOCKED story. The two creation affordances ("This needs..." and
"This blocks...") write the SAME pair; they only choose which side the current story sits on. A
violation is a scheduling mistake: the blocked story is placed in an EARLIER sprint than its blocker,
so the dependent is planned before the thing it needs. Per G7 a violation evaluates only when BOTH
stories are scheduled in sprints; if either is in the backlog the pair is neutral. The badge D number
is per-pair and shared by both cards (D1 on both endpoints of the first pair), so the pair is a
first-class thing with its own identity. That shared-badge requirement is the strongest argument for
the field shape (see the lead PROPOSE).

RULINGS BAKED INTO THIS BRIEF (director-ruled R1 to R9, do not silently change)
These follow from the spec, the screens, and the journeys, which are signed off. The mechanism
details under each are PROPOSE items.

- R1 ONE DIRECTED PAIR, TWO CREATION AFFORDANCES. A dependency is one link type stored as a directed
  pair (a prerequisite/blocker and a dependent/blocked). "This needs..." and "This blocks..." both
  create the same kind of pair; they differ only in which side the current story takes. There is no
  second link type in v1 (spec P0 #5).

- R2 THE CARD EDITOR IS THE ONLY HOME FOR CREATE AND REMOVE. Dependencies are created and removed in
  the card editor (Screen 2, Journey 4 sign-off). The board renders badges (this slice) and later the
  tethers/connectors (slice 2); it never creates or edits a link. No hover-to-link, no board-side
  affordance.

- R3 1-TO-MANY, PICKER-BASED, EXCLUDING SELF AND ALREADY-PAIRED. One prerequisite can block several
  stories, stored as separate pairs (spec P0 #5). The picker lists all other stories grouped by
  location and excludes the current story and any story already paired with it (Screen 2). Selecting a
  story creates the pair, assigns the next D number, and closes the picker.

- R4 ANY STORY IS PICKABLE, INCLUDING BACKLOG; VIOLATIONS NEED BOTH SIDES SCHEDULED (G7). Backlog
  stories are pickable. A pair where either side is in the backlog is NEUTRAL (no violation). A
  violation evaluates only when both stories sit in sprints, and is true when the blocked story's
  sprint index is strictly less than the blocker's.

- R5 SHARED D BADGE ON BOTH CARDS, NEUTRAL THIS SLICE. Each pair shows a shared badge (D1, D2...) on
  both endpoint cards, via the single shared storyCard renderer, so it appears on the board and in the
  backlog (Screen 1 "badges always visible"). In THIS slice the badge is NEUTRAL chrome (no capacity
  colours; plum/ink only). The board-side RED violation treatment on the badge/card is slice 2.

- R6 VIOLATION IS VISIBLE AT CREATION TIME, IN THE EDITOR ROW (Screen 2). The Dependencies section
  lists each link as a row (shared badge, direction "needs"/"blocks", paired story title, paired
  story location in mono, remove control). A violating pair renders its row in the red treatment with
  the location annotated (e.g. "Sprint 2, before this"), so the mistake shows in the editor, not only
  on the board. This is the one place the violation selector is consumed in slice 1.

- R7 DELETES PRUNE PAIRS ATOMICALLY (the conservation invariant; zero-data-loss). Deleting a story
  removes every pair that references it, in the same action. Deleting an epic in "delete" mode removes
  its child stories AND every pair referencing them, atomically. A dangling pair id is a load-boundary
  failure (validatePlan would reject the next load), which on this app is the one unforgivable failure.
  This is a reducer change in this slice, flagged hardest below.

- R8 ADDITIVE SCHEMA BUMP THROUGH THE SEAM. The store gains one top-level field; meta.schemaVersion
  goes 1 to 2. CURRENT_SCHEMA bumps to 2 and MIGRATORS[1] backfills a v1 plan with the empty field.
  validatePlan learns the field (an array; each pair references two distinct existing story ids; no
  duplicate pair). The migrator is additive and never deletes; an existing v1 autosave or a v1
  exported file loads and gains the empty field with no data loss.

- R9 THE VIEW DISPATCHES ONLY THE NEW ACTIONS, AND DEPENDS ONLY ON STORY IDS. The editor dispatches
  LINK_DEP and UNLINK_DEP (and the existing story actions). The pair stores story ids only, never card
  positions or sprint indexes, so it survives every MOVE_STORY and every settings regeneration. The
  view never mutates state. Stack order remains facilitation theatre and never feeds a violation; the
  recorded pair plus the sprint INDEX of each side is the only ordering truth (resolved decision 6).

THE SUBTLE CALL (flag hardest here): THE FIELD SHAPE, THE MIGRATION, AND DELETE PRUNING
Three coupled decisions carry this slice, and a wrong field shape makes slice 2 and the export inherit
an awkward model.
- The field shape (lead PROPOSE). I recommend a TOP-LEVEL deps array of directed pairs, e.g.
  deps: [ { id, blockerId, blockedId } ], over story.dependsOn. Reasons: the spec requires a SHARED
  badge identity on both cards (D1 on both endpoints), which makes the pair a first-class entity with
  its own id and its own D number (the array index plus one), shared by construction; either-side
  creation just chooses which story id is blockerId vs blockedId at creation, storing one direction;
  1-to-many is many pairs with the same blockerId, nothing special; conservation (both ids exist,
  distinct, no duplicate) lives in one place; LINK_DEP adds a pair and UNLINK_DEP removes one by id,
  which is the cleanest action/event shape for the multiplayer-insurance model; and deleting a story
  is one filter over deps. The alternative, story.dependsOn: string[], avoids a new top-level key but
  scatters the relationship across two story records, makes the shared D-number identity fiddly
  (the pair has no id), and makes delete-pruning scan every story. Trade-off to weigh: deps is a new
  top-level key and a state-shape change. I judge that acceptable because the schema bump and the
  seam exist precisely for this. PROPOSE the shape, the exact pair object, and confirm the
  blocker/blocked naming (blockerId = prerequisite/do-first; blockedId = dependent).
- The migrator. PROPOSE MIGRATORS[1] = (plan) => ({ ...plan, deps: [], meta: { ...plan.meta,
  schemaVersion: 2 } }) and CURRENT_SCHEMA = 2, with createInitialState seeding deps: [] and
  schemaVersion: 2. Confirm the migrator sets meta.schemaVersion (so a re-export stamps v2) and that a
  v1 restore and a v1 file both flow through migratePlan and gain the empty array. Note exportPlan
  stamps schemaVersion from state.meta.schemaVersion, so once the store is v2, saves and files are v2.
- Delete pruning (R7). PROPOSE the exact change to deleteStory and deleteEpic(delete-mode) to filter
  deps by the removed ids in the same reducer step, conserving the no-dangling-id invariant. This is
  the data-loss-critical line in the slice; assert it directly (case 13 below).
- Cycle handling (PROPOSE, I recommend the light touch). Reject a self-dependency (blockerId ===
  blockedId) and a duplicate pair, both cheaply, at the picker (exclusion) and at the load boundary
  (validatePlan). For true cycles (A needs B, B needs A), I recommend NOT building graph detection in
  v1: the tool flags and never blocks, and a cycle simply produces mutual violation flags when both
  are scheduled, which is honest; a DFS cycle check earns its place only if a cycle causes a real
  failure, and here it does not. If you want cycle rejection at the load boundary, say so and I will
  scope it as a defined addition; my recommendation is to defer it.

ARCHITECTURE CONSTRAINT (non-negotiable, RoE quality gate)
- The pure selectors, the validatePlan extension, and the migrator are PURE, DOM-free, and unit-tested
  BEFORE the editor DOM or any badge wiring, the same pure-first pattern Brief 1 used for capacity
  maths and Brief 5/6 used for the I/O core and the summary/relative-time helpers. The picker DOM, the
  editor section, and the badge rendering are browser-verified, not unit-tested, the same boundary
  Brief 3 kept the drag gesture on and Brief 6 kept the prompt DOM on.
- No new clock read. Dependencies carry no timestamp. todayISO/nowISO stay the only two boundary clock
  reads in main.js.
- The view never mutates state. The editor dispatches LINK_DEP/UNLINK_DEP (ids minted at the creator
  edge) and the existing story actions. Selectors read; they never write.
- One new top-level field only. No change to meta (beyond schemaVersion), settings, sprints, backlog,
  or the stories/epics maps. The pair stores story ids only.
- Reuse the points/title authorities and the existing modal shell, the existing storyCard, and the
  existing delegated click wiring; do not fork them.

THE PURE CORE (build and unit-test FIRST, DOM-free)
PROPOSE the module home and exact names; keep the module count down (a dedicated dep-selectors.js
mirrors board-selectors.js / backlog-selectors.js, or fold into board-selectors.js if it fits without
bloating it). Likely contents:
- storyLocation(state, storyId) returns where a story sits: { kind: "sprint", index } |
  { kind: "backlog" } | null (null for an unknown id; pure, no throw). Drives the picker grouping, the
  editor-row location label, and the violation check.
- locationLabel(state, location) returns a mono label, e.g. the sprint name from state.sprints[index]
  ("Sprint 3") or "Backlog".
- depRole(dep, storyId) returns this story's side: "blocks" (storyId is the blocker/prerequisite) |
  "needs" (storyId is the blocked/dependent) | null.
- depLabel(state, dep) returns the shared badge string "D" + (index in state.deps + 1).
- isViolation(state, dep) returns true only when BOTH endpoints are in sprints AND the blocked story's
  sprint index is strictly less than the blocker's (R4). Backlog either side, same sprint, or correct
  order all return false.
- depsForStory(state, storyId) returns the editor rows: an array of { dep, label, role, otherId,
  otherTitle, otherLocation, violation } for every pair touching storyId, in deps order.
- depBadges(state, storyId) returns the card badges: an array of { label, violation } for every pair
  touching storyId. THIS slice renders label only (neutral); violation is carried for slice 2 and is
  already used by depsForStory for the editor row.
- pickableDepTargets(state, storyId) returns the picker list: every OTHER story not already paired
  with storyId, each as { id, title, location }, for grouping and exclusion (R3).
Anything with branching logic (isViolation's both-scheduled-and-ordered rule, depRole, the D-number
derivation, the pickable exclusion) is unit-tested with real values, not eyeballed. The D number is
derived from deps order and recomputed on render; removing a pair renumbers the rest, which is
acceptable for v1 (the badge is a within-session visual aid, not a stable external reference). PROPOSE
if you would rather store a stable per-pair number; I recommend derived.

WIRING (the schema bump, the actions, the delete pruning, the editor section, the badge)
- Schema (plan-io.js + store.js): bump CURRENT_SCHEMA to 2; add MIGRATORS[1] (backfill deps: [], set
  meta.schemaVersion: 2); seed deps: [] and schemaVersion: 2 in createInitialState; extend validatePlan
  to require deps is an array and each pair references two distinct existing story ids with no
  duplicate pair (PROPOSE the exact reason strings, naming the first failure, in the house style of the
  existing reasons). Update the store.js PlanState typedef.
- Actions (actions.js + store.js): add LINK_DEP and UNLINK_DEP to the frozen ActionTypes; creators
  linkDep({ blockerId, blockedId }) minting newId("dep") at the edge and unlinkDep({ id }); reducer
  cases that append the pair and filter by id respectively. The reducer trusts validated payloads
  (the picker is the creation gate; validatePlan is the load backstop), consistent with the rest of the
  app. The vocabulary goes from 15 to 17 actions.
- Delete pruning (store.js, R7): deleteStory also filters state.deps to drop any pair referencing the
  deleted id; deleteEpic("delete") also filters state.deps to drop any pair referencing a removed child
  id. Both in the same reducer step, lastReturnedStoryIds handling unchanged.
- Card editor (card-editor.js): add a Dependencies section below Summary. Existing links render as
  rows from depsForStory (shared badge, "needs"/"blocks", paired title, paired location in mono, a
  remove control that dispatches unlinkDep). A violating row takes the red treatment with the location
  annotated (R6). Two buttons, "This blocks..." and "This needs...", each open the picker. The picker
  is a search input plus pickableDepTargets grouped by location (Sprint 1, Sprint 2..., Backlog);
  selecting dispatches linkDep with the current story on the chosen side, assigns the D number, and
  closes the picker. Reuse the modal shell and the existing dirty-tracking/footer. PROPOSE whether the
  picker is an inline expanding panel within the editor or a nested modal; I lean inline panel (one
  modal at a time, simpler focus management).
- Badge (backlog.js storyCard, render.js + backlog.js callers): extend storyCard to accept an optional
  badges argument and render the neutral D badges after the points chip; render.js (board cards) and
  backlog.js (backlog rows) compute depBadges(state, story.id) and pass it in. PROPOSE the storyCard
  signature change (a third badges param is the least invasive).

UI (Screen 2 dependencies section + picker, and the neutral badge; everything else deferred)
- Dependencies section (in the card editor, below Summary):
  - Existing links as rows: shared badge, direction word ("needs" or "blocks"), paired story title,
    paired story location in mono, remove control. A violating row uses the red treatment with the
    location annotated (e.g. "Sprint 2, before this").
  - "Add dependency": two buttons, "This blocks..." and "This needs...", matching Journey 4 language.
  - Picker: a search input and a list of all other stories grouped by location (Sprint 1... then
    Backlog), excluding the current story and stories already paired with it. Selecting one creates the
    pair, assigns the next D number, and closes the picker.
- Card badge (board and backlog, via storyCard): the shared D badge (D1, D2...), NEUTRAL chrome this
  slice, after the points chip. It is the visible proof a link exists.
- Branding: instrument-core tokens, data-app="plan". Badges and the picker use plum accent and
  :focus-visible rings, IBM Plex Mono for the D label and any numbers. The remove control uses the
  danger-ghost treatment consistent with the card editor's Delete. NO capacity colours on the neutral
  badge or the picker (amber/red mean capacity and nothing else). The editor-row violation treatment
  uses the existing danger/red treatment, the one Screen 2 calls for, and that is the only red in this
  slice. Minimum 13px body, mono numbers/labels 12px+.

OUT OF SCOPE (parking lot; do not "while we're here" these, RoE anti-pattern)
- The board drawing layer: cross-sprint connectors (on hover/select), the always-visible same-sprint
  tether, and the board-side RED violation treatment on cards and connectors. All slice 2, Brief 8.
  This slice draws no SVG and adds no board-side red.
- The export warnings section and the over-commitment section (P0 #6, a separate brief). This slice
  ships isViolation but wires it only to the editor row; the export consumer is built in #6.
- Cycle detection (deferred by recommendation; if ruled in, a defined addition to validatePlan and the
  picker, not a "while we're here").
- A second link type, link metadata (notes, type), or weighting. v1 is one directed pair, no metadata.
- Any auto-move of cards on linking (the spec forbids it; cards are never auto-moved).
- A persistent or mid-session New-plan control (R4 of Brief 6 deferred it); multiple boards (P2);
  stretch toggle, labels, parked lane, stats strip (P1); sub-1280px backlog drawer; dark mode.

ASSERTED CASES (assert these exact outcomes; derive the rest; tests assert real values)
Build fixtures as real plan states (a fresh default plan; a plan with two stories placed in different
sprints and one in the backlog; a plan with a valid pair; a plan with a violating pair). Migrator and
validation:
1. MIGRATOR ADDS THE FIELD. MIGRATORS[1] on a v1 plan returns a plan with deps: [] and
   meta.schemaVersion === 2, and changes nothing else (assert a representative key is untouched).
2. MIGRATE v1. migratePlan on a v1 plan returns ok with deps: [] and schemaVersion 2.
3. MIGRATE v2 IS A NO-OP. migratePlan on a v2 plan returns ok and is unchanged.
4. NEWER VERSION STILL FAILS. migratePlan on a v3 plan returns not-ok "saved by a newer version of
   sprintplan" (the existing guard still holds after the bump).
5. FRESH PLAN IS v2. createInitialState(...) has meta.schemaVersion === 2 and deps deep-equal [].
6. VALID PAIR PASSES. validatePlan on a v2 plan with one pair referencing two distinct existing story
   ids returns ok.
7. UNKNOWN STORY FAILS. A pair referencing a non-existent story id fails with a reason naming that id.
8. SELF-DEP FAILS. A pair with blockerId === blockedId fails with a clear reason.
9. DUPLICATE PAIR FAILS. Two identical pairs (same blocker and blocked) fail with a clear reason.
10. deps NOT AN ARRAY FAILS. A non-array deps fails with a "missing or invalid key: deps" style reason.
Selectors:
11. LOCATION. storyLocation returns { kind: "sprint", index: 1 } for a story placed in the second
    sprint, { kind: "backlog" } for a backlog story, and null for an unknown id.
12. ROLE AND LABEL. For a pair { blockerId: B, blockedId: A }: depRole(dep, A) === "needs",
    depRole(dep, B) === "blocks", and depLabel === "D1"; a second pair labels "D2"; both endpoints of
    pair 1 share "D1".
13. DELETE PRUNES (the data-loss-critical case). In a plan with story A in a pair, dispatching
    deleteStory(A) leaves deps with no pair referencing A, and the surviving story shows no badge for
    that pair. Likewise deleteEpic(epicOfA, "delete") prunes A's pairs. Assert no dangling pair remains
    (the next validatePlan would pass).
14. VIOLATION TRUE. A pair whose blocked story sits in an earlier sprint than its blocker, both placed,
    isViolation === true.
15. VIOLATION FALSE BY ORDER, SAME-SPRINT, AND BACKLOG. Blocked later than blocker: false. Both in the
    same sprint: false. Either side in the backlog: false (G7, not evaluated).
16. PICKER EXCLUSION. pickableDepTargets(state, A) excludes A itself and any story already paired with
    A, and includes a backlog story (R3, R4).
Browser-verified, not unit cases:
- The card editor shows a Dependencies section with "This blocks..." and "This needs..." buttons.
- "This needs..." opens the picker; it lists other stories grouped by location (Sprint 1..., Backlog),
  excludes the current story and already-paired stories; selecting one creates the pair, assigns D1,
  and closes the picker; the row appears with direction, paired title, and location.
- Both endpoint cards show the neutral D1 badge, verified on the board and in the backlog.
- Creating a "needs" pair where the dependent already sits in an EARLIER sprint than the prerequisite
  renders the editor row red with the location annotated (R6, Screen 2), with no board-side red yet
  (deferred to slice 2).
- The remove control on a row dispatches unlinkDep; the badge disappears from both cards.
- Deleting a story that is in a pair removes the pair; the other card's badge disappears; no console
  error (R7).
- A duration shrink that returns a placed dependent to the backlog keeps the pair (badge persists,
  violation clears to neutral), no data loss (resolved decision 7).
- A pre-Brief-7 v1 localStorage save resumes via the Brief 6 prompt and migrates to v2 (deps: []),
  no data loss, no console error; a v1 board FILE (app:"sprintplan", schemaVersion:1) imports and gains
  deps: [].

HOUSEKEEPING (carry-forward, still NOT actioned this brief; record as remaining open)
- Theme-token promotion still open: promote --plum / --plumwash, #glyph-plan, and the 8 epic-palette
  tokens to the shared instrument-core source; register plan as a SURFACE in the theme manifest.mjs and
  add the check-theme-drift test. Suite-level, out of scope for a feature brief.
- Dragula vendoring decision stands (docs/housekeeping-dragula-vendoring.md): keep per-app copies; no
  cross-repo move. No action.
- Doc/code naming note from Brief 6 still stands: extractPlan's upload mode is "file" in code (some
  prose says "import"). Trust the code's name.

BRANDING
instrument-core tokens, data-app="plan". Badges and the picker use plum accent for selection and
:focus-visible rings, IBM Plex Mono for the D label and every number. The remove control uses
danger-ghost (consistent with the card editor's Delete). The editor-row violation uses the existing
danger/red treatment and is the only red in this slice; no board-side red, no capacity colours on the
neutral badge or picker. Minimum 13px body, mono labels/numbers 12px+.

DEFINITION OF DONE
- The pure selectors, the validatePlan extension, and MIGRATORS[1] have passing unit tests asserting
  the cases above with real values, including the migrator backfill (1 to 5), the validation rejects
  (7 to 10), the role/label sharing (12), the delete pruning (13), and the violation rule across order,
  same-sprint, and backlog (14, 15). isViolation and depRole are clock-free and pure.
- Schema bumped additively: CURRENT_SCHEMA = 2, MIGRATORS[1] backfills deps: [], createInitialState
  seeds deps: [] and schemaVersion 2; a v1 restore and a v1 file both migrate with no data loss. The
  migrate-newer guard still fails (4).
- Two new actions only (LINK_DEP, UNLINK_DEP), ids minted at the creator edge; the reducer cases are
  trivial (append a pair / filter by id) and are each only ever dispatched with a valid payload. The
  vocabulary is 17 actions.
- Deletes prune pairs atomically (R7): no settings change, no delete, and no move can leave a dangling
  pair id. The zero-data-loss bar holds; validatePlan would pass after any delete.
- Dependencies are created and removed ONLY in the card editor (R2); the board renders only the neutral
  shared badge this slice (R5). The editor row flags a violation at creation time with its location
  (R6, Screen 2).
- The pair stores story ids only and survives MOVE_STORY and every settings regeneration (R9, resolved
  decision 6). Stack order never feeds a violation.
- Verified in the browser against Screen 2 and Journey 4 (and the v1-save migration against Journey 6),
  zero console errors.
- I can explain every line. Build-log entry drafted (AI drafts, I sign off). The handoff note for
  Brief 8 records what slice 2 inherits: the deps model, isViolation, depBadges (with the violation
  flag already carried), storyLocation, and the neutral badge, so slice 2 is purely the board SVG layer
  plus the board-side red treatment.

Start by PROPOSING: the field shape (top-level deps array of directed pairs vs story.dependsOn) with
the exact pair object and the blocker/blocked naming; the migrator body and the CURRENT_SCHEMA bump,
and where createInitialState seeds the field; the validatePlan additions and their exact reason
strings (unknown story, self-dep, duplicate pair, non-array deps); the module home and exact names for
the pure selectors (storyLocation, depRole, depLabel, isViolation, depsForStory, depBadges,
pickableDepTargets), and whether the D number is derived or stored; the LINK_DEP/UNLINK_DEP action and
creator shapes and the delete-pruning change to deleteStory/deleteEpic; the card-editor Dependencies
section and whether the picker is an inline panel or a nested modal; the storyCard signature change for
the badge; and your ruling on cycle handling (I recommend reject self-dep and duplicate pair, defer
true-cycle detection). No feature code yet.
