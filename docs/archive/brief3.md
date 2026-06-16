BRIEF 3 — Drag-and-drop placement (P0 #3)

Read first: docs/sprintplan-mvp-spec.md (v0.5), docs/v1-screen-designs.md (v1.0),
docs/user-journeys.md (v1.0), docs/aide-rules-of-engagement.md, and
docs/build-state-after-brief2.md (what the code actually is now, not just what the
specs say). RoE cadence applies: PROPOSE before you build. No feature code until I
approve the approach.

GOAL
The keystone slice: backlog story cards become draggable into sprint containers, between
sprints, and back to the backlog. This is P0 #3. It is the move that makes the board do
its job: stories land in sprints, the capacity pills light up for the first time, and the
deferred dependency picker gets the placement it was waiting on. The store, the capacity
maths, and the card visuals already exist; this brief mostly vendors a drag library, adds
one conserving action, renders placed cards, and feeds the pills real numbers.

Placement only in this brief. Not the honesty banner (P0 #4, next brief), not dependencies
(P0 #5), not exports (P0 #6).

WHAT THIS SLICE EXTENDS (from build-state-after-brief2.md)
The seams are already cut. A story's location is array membership: its id sits in backlog[]
or in exactly one sprint's placedStoryIds[], never as a field on the story. Regeneration
already conserves placedStoryIds and returns displaced stories to the top of the backlog.
The reducer is pure, actions are serializable, ids are minted in action creators. The store
private helper removeIdFromArrays(state, id) already exists and is the spine of the move.
This brief adds MOVE_STORY (the obvious next action), renders placed cards inside sprint
bodies (today they are always the static "Drop stories here"), and corrects how the pill's
placed figure is computed. It invents no new architecture.

THE FINDING THAT DRIVES THIS BRIEF (read before the rulings)
renderBoard currently computes the pill's placed figure as placedStoryIds.length. That is a
COUNT. Capacity is POINTS (velocity x (1 - buffer%)). The two have been numerically equal
only because every sprint has been empty (length 0 = 0 points). The instant a story lands,
length is wrong: a sprint holding three stories of 8, 8 and 3 points is at 19 points, not 3.
Placed must become the SUM OF POINTS of the placed stories. This is a count-vs-points bug
sitting latent in the danger zone the RoE explicitly flags (capacity maths). Brief 3 fixes
it, with a pure tested selector, and the asserted cases below are built to fail if anyone
ever feeds the pill a count again.

RULINGS BAKED INTO THIS BRIEF (flag if you disagree, do not silently change)
- PLACED IS POINTS, NEVER COUNT. The pill's placed figure is the sum of the points of the
  stories in that sprint's placedStoryIds, computed by a pure selector. pillState already
  takes (placed, capacity) and is correct; it must be fed points. (See the finding above.)
- A MOVE IS REMOVE-THEN-INSERT, AND EVERY ID IS CONSERVED. MOVE_STORY removes the id from
  wherever it currently sits (reusing removeIdFromArrays) and inserts it into the target
  array at a given position. A story id is in exactly one array at all times: never two,
  never zero. No move ever deletes a story or duplicates an id. This is the zero-data-loss
  bar and it is load-bearing here, the same way delete atomicity was in Brief 2.
- DRAGGING NEVER CHANGES A STORY'S epicId. epicId is editor-only (the Brief 2 contract:
  only EDIT_STORY regroups a story). A within-backlog drag reorders backlog[] but leaves
  epicId untouched. This is the one that shapes the dragula container question below, so
  resolve it in the proposal, do not let a drop silently reparent a story.
- WITHIN-SPRINT AND WITHIN-BACKLOG REORDER IS FACILITATION THEATRE. It is the same
  MOVE_STORY (target array == source array, new index), but order never affects totals,
  capacity, pill state, warnings, or exports (spec resolved decision 6). Build it so the
  order is preserved for the eye and ignored by every number.
- THE STORE IS THE SINGLE SOURCE OF TRUTH; DRAGULA'S OPTIMISTIC DOM MOVE MUST NOT FIGHT THE
  RENDER. dragula mutates the DOM on drop before any action runs. Our architecture renders
  from state. So the drop handler reads the intended move, reverts dragula's DOM mutation
  (drake.cancel(true)), dispatches MOVE_STORY, and lets the single state-driven render put
  the node where state says it goes. The gesture is dragula's; the state change is the
  action's; the DOM is the render's. No view-layer mutation of state, ever (RoE gate).
- THE BOARD RENDERS THE MINIMAL CARD. A placed card shows the epic colour dot, the title,
  and the points chip (mono), reusing the backlog card visual. No dependency badges,
  tethers, violation borders, or connectors (all dependencies brief). An empty sprint keeps
  the muted "Drop stories here". Clicking a placed card opens the card editor (consistency
  with the backlog), so dragula must distinguish a click from a drag and not fire both.
- THE BACKLOG PANEL NOW SHOWS UNPLACED STORIES ONLY. Placed stories live in their sprint,
  not in the panel. The epic group row's meta shows the UNPLACED count and unplaced points
  (so the row tallies the rows actually visible beneath it). This closes the Brief 2
  housekeeping flag (storyCount-vs-unplaced). Confirm backlogGroups is driven by backlog[]
  membership so placed stories leave the panel for free; if it walks stories{} instead, fix
  it to walk backlog[].

WHERE A STORY GOES WHEN IT RETURNS TO THE BACKLOG (the subtle call, flag hardest here)
Two return paths now coexist and must not be conflated:
- REGENERATION return (already built): a duration or length change that removes a sprint
  sends its stories to the TOP of backlog[] (front of array) and drives the toast via
  lastReturnedStoryIds. Unchanged. Keep the front-of-array slot reserved for this.
- MANUAL drag sprint->backlog (new): the facilitator drags a card back. PROPOSE where it
  lands. My ruling, weakest of this brief's calls and the one most likely to be overturned:
  a manually returned story drops at the pointed position in backlog[] (theatre, like any
  reorder) and does NOT change epicId; it does NOT touch lastReturnedStoryIds and fires no
  toast (the toast means "the system moved your stories", not "you dragged one"). If you
  would rather a manual return also go to the top for consistency, say so.

ARCHITECTURE CONSTRAINT (non-negotiable, RoE quality gate)
- Single store, discrete named action, pure reducer. MOVE_STORY is pure and unit-tested
  before any DOM is wired. The drop handler dispatches it; it never mutates state.
- The new placed-points figure is a PURE selector over store state, DOM-free and
  unit-tested, the same pattern Brief 1 used for capacity and Brief 2 for the backlog
  groups. Build and test the selector and the action first; wire dragula and the board
  render second.
- dragula is a MATURE LIBRARY, VENDORED, NOT HAND-ROLLED (spec technical note). It is
  already in the suite at retrospective/public/vendor/dragula/. Copy it into
  plan/public/vendor/dragula/. Do not reimplement drag behaviour.

THE ACTION — to ADD this brief (match the shipped convention: SCREAMING_SNAKE, { type, payload })
- MOVE_STORY: moves one story to a target array at a target index. PROPOSE the exact payload
  shape. It must carry enough to identify the story, the destination (backlog, or a sprint by
  index), and the insertion position. Required behaviour and invariants:
  - Remove the id from its current array (removeIdFromArrays), then insert at the target
    position. Conserve the id (rulings above).
  - Reject a move of an unknown story id and a move to an out-of-range sprint index (defensive,
    pure, no throw that corrupts state; propose the failure mode, e.g. return state unchanged).
  - Same-array move (reorder) is valid and is theatre: it changes order only.
  - epicId untouched. points untouched. No other story moves.
  - Autosave persists it for free (it is an action), so a refresh keeps every placement.
No new actions beyond MOVE_STORY. No LINK_DEP (dependencies, later brief).

SELECTORS / DERIVED VIEW DATA (pure, unit-tested, DOM-free)
- sprintPlacedPoints(state, sprintIndex): sum of points of the stories whose ids are in that
  sprint's placedStoryIds. This is what feeds the pill. The keystone new selector.
- epicSummary: extend (or pair with) it so the backlog row can show the UNPLACED count
  alongside the unplaced points it already computes. PROPOSE whether to add unplacedCount to
  epicSummary or expose it separately; keep the existing unplacedPoints behaviour intact.
- backlogGroups: confirm it is driven by backlog[] membership (placed stories drop out
  automatically). If not, make it so. No ad-hoc traversal of stories{} in the view.
- Render the board pill from sprintPlacedPoints + the existing sprintCapacity + pillState.
  Render the panel from backlogGroups + epicSummary only.

DRAG AND DROP WIRING (dragula)
- Vendor dragula into plan/public/vendor/dragula/ from the retrospective copy. Load it the
  way the suite already does.
- Drop targets: each sprint body, and the backlog. PROPOSE the backlog container granularity
  and defend it against the epicId ruling: if each epic group is its own dragula container, a
  cross-group drop implies a reparent, which is forbidden, so either the backlog is one flat
  container (epic headers as non-draggable decorations) or cross-group drops are refused via
  dragula's accepts. Pick one and justify it.
- On drop: read source container, target container, and sibling index; translate to a
  MOVE_STORY payload; revert dragula's DOM move with drake.cancel(true); dispatch; let the
  subscriber re-render from state (the cancel-then-dispatch-then-render reconciliation in the
  rulings).
- Click vs drag: a placed card (and a backlog card) opens the editor on click but must not
  open it at the end of a drag. Verify dragula's threshold handles this and the delegated
  click listener does not double-fire.

UI — Sprint container (Screen 1, sprint container anatomy + story card board side)
- Sprint body renders its placed cards in placedStoryIds order, each: epic colour dot,
  title, points chip (mono). Reuse the backlog card visual; do not invent a second card.
- Empty sprint keeps the muted "Drop stories here" empty state as the drop affordance.
- Header pill now reads placed / capacity with placed = sprintPlacedPoints, and colours
  neutral / amber / red via the existing pillState. This is the first time the pill moves
  off neutral. The amber/red THRESHOLDS and the honesty BANNER text are not added here; only
  the pill colour, which is already built and tested in plan-maths. The banner is next brief.
- Partial final sprint still shows its dashed border and partial tag; its prorated capacity
  now actually constrains a real placed total.

UI — Backlog panel (Screen 1, backlog panel)
- Story rows are now drag sources. Otherwise unchanged from Brief 2 (click opens the editor).
- Epic group row meta shows unplaced count and unplaced points (ruling above).
- A backlog emptied by placing everything still shows its epic groups (the groups persist
  even when all their stories are placed, so the facilitator can still drag back into them);
  PROPOSE the empty-group treatment if it looks wrong (e.g. a faint "all placed" hint).

OUT OF SCOPE (parking lot; do not "while we're here" these — RoE anti-pattern)
- Capacity honesty banner (P0 #4), the over-committed nudge and its dismiss-per-session.
  Pills colour here; the banner is the next brief and the natural follow-on.
- Dependencies: badges, tethers, cross-sprint connectors, the picker, violation borders
  (P0 #5). The card editor's Dependencies section stays deferred; its picker groups
  candidates by sprint location, which this brief finally provides, so it unblocks next.
- Exports (P0 #6); Resume / New-plan prompt (Screen 3, still silent restore); JSON
  import/export (P0 #7).
- Stretch toggle, labels, parked lane, stats strip (all P1).
- Sub-1280px backlog drawer (still deferred; target viewport >= 1280px).

ASSERTED CASES (assert these exact outcomes; derive the rest; tests assert real values)
Seed fixtures directly into store state. Defaults give 7 sprints, capacity 18.
1. PLACED IS POINTS, NOT COUNT (the keystone). A sprint holding stories of 8 and 8 points:
   sprintPlacedPoints = 16, pillState(16, 18) = neutral. Add a 3-pointer: placed = 19,
   pillState(19, 18) = amber (5.6% over). Add a 5-pointer: placed = 24, pillState(24, 18) =
   red (33% over). Every one of these would read neutral if placed were the count (2, 3, 4),
   so the test fails the moment someone uses length.
2. MOVE_STORY backlog->sprint: a story in backlog[] moves to sprint index 2 at position 0.
   After: the id is gone from backlog[], present at sprints[2].placedStoryIds[0]; total story
   count unchanged; backlogGroups no longer includes it; that sprint's placed points rise by
   the story's points.
3. MOVE_STORY sprint->sprint: a placed story moves from sprint 1 to sprint 3. After: gone
   from sprint 1's array, present in sprint 3's; both pills recompute; conserved; epicId
   unchanged.
4. MOVE_STORY sprint->backlog (manual return): the story leaves the sprint and reappears in
   backlog[] (at the proposed position); it is back in backlogGroups under its UNCHANGED
   epic; lastReturnedStoryIds is NOT set (no toast); the sprint's placed points drop.
5. REORDER IS THEATRE: a sprint holds [A(5), B(8)], placed = 13. Move A after B within the
   same sprint: order is now [B, A]; placed still 13; pillState unchanged; no other sprint
   touched. Asserts order independence from every number.
6. epicId IS DRAG-INVARIANT: a story under epic E1 moved backlog->sprint->sprint->backlog
   has epicId === E1 at every step. Guards the Brief 2 editor-only contract.
7. CONSERVATION UNDER MOVES: after an arbitrary sequence of MOVE_STORY actions, the multiset
   of all ids across backlog[] and every sprint's placedStoryIds equals exactly the keys of
   stories{} — no duplicate, no loss. The zero-data-loss assertion for this brief.
8. REGENERATION AFTER REAL PLACEMENT (intersection guard): place two stories into sprint 7
   (the partial) via MOVE_STORY, then shrink duration to 1 month (3 sprints). Sprint 7 is
   removed: assert both stories returned to the TOP of backlog[], zero stories deleted from
   stories{}, surviving sprints' placements intact, lastReturnedStoryIds set so the toast
   fires. Proves the two features compose without data loss.
9. BACKLOG SHOWS UNPLACED ONLY: before, an epic E2 has 3 backlog stories; epicSummary shows
   3 / their points. Place one into a sprint: the backlog panel now shows 2 under E2, the
   row meta drops to 2 / the remaining points, and the placed story renders inside its
   sprint. Total story count is unchanged throughout.

BRANDING
instrument-core tokens, data-app="plan". Placed cards reuse the backlog card visual: epic
colour dot from the palette, title in Hanken, points in IBM Plex Mono. The pill stays mono.
Plum accent for focus rings and any drag affordance; capacity amber/red are reserved for the
pill state and appear here for real for the first time, on the pill only, nowhere else. Do
not fork tokens.

DEFINITION OF DONE
- MOVE_STORY and sprintPlacedPoints have passing unit tests asserting the cases above (real
  values, not "runs"). Conservation and the points-not-count assertion are explicit.
- dragula is vendored under plan/public/vendor/dragula/ and drives the gesture; every drop
  goes through MOVE_STORY (no view-layer state mutation); the cancel-dispatch-render
  reconciliation is in place.
- The board renders placed cards inside sprints; pills show placed POINTS and colour
  neutral / amber / red; the backlog panel shows unplaced stories only with unplaced counts.
- No data-loss path: no move deletes, duplicates, or orphans a story; regeneration after
  real placement still conserves (re-verify against Brief 1 and Brief 2 invariants).
- Click still opens the editor; a drag does not. Verified in the browser against P0 #3
  acceptance + Screen 1 (sprint container, story card board side, backlog panel, drag and
  drop) with zero console errors.
- I can explain every line. Build-log entry written (AI drafts, I sign off).

Start by PROPOSING: the MOVE_STORY payload shape and its invalid-move failure mode; the
sprintPlacedPoints signature and the epicSummary unplaced-count change; the dragula container
granularity (and how it honours the epicId ruling); the cancel-then-dispatch-then-render drop
reconciliation; the click-vs-drag disambiguation; and the manual-return landing position.
No feature code yet.
