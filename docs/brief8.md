BRIEF 8: Dependencies, P0 #5, slice 2 of 2 (the board drawing layer)

Read first: docs/sprintplan-mvp-spec.md (v0.5: P0 #5 "Story-to-story dependency link", and the
"zero data-loss bugs" quality bar), docs/v1-screen-designs.md (v1.0: Screen 1 card anatomy "badges
always visible", and ruling G7 "violations evaluate only when both scheduled; backlog-side pairs
neutral"), docs/user-journeys.md (v1.0: Journey 4 "Mark dependencies" and the sign-off "dependency
control lives in the card editor only; arrows, badges and tethers render on the board, but the link
is created and removed in the card editor"), docs/aide-rules-of-engagement.md, and
docs/build-state-after-brief7.md (what the code actually is now, not just what the specs say; read
the "What Brief 8 will need to touch" section and the Known limitations). RoE cadence applies:
PROPOSE before you build. No feature code until I approve the approach. Feature branch per brief
(brief-8-dependencies-drawing). Branch off main.

PRECONDITION (branch model): main carries briefs 1 to 7 once PR #5 merges (--merge, not squash, so
the build-log SHAs stay valid). Brief 8 branches off main AFTER #5 is merged. Do not stack on
brief-7-dependencies-data. This brief adds NO action and NO schema change: it is a pure view over the
slice 1 model.

THE LAYOUT REALITY (read before anything else, so you do not design the wrong picture)
The board is a VERTICAL stack, not a horizontal program board. render.js builds one CSS grid,
grid-template-columns 48px 1fr: column 1 is the month rail, column 2 is the sprint column. Every
sprint is a full-width ROW stacked top to bottom (el.style.gridRow = sprint.index + 1), and the cards
inside a sprint are a vertical list in .sprint-body. There is no team/swimlane dimension (single-team
by spec). So:
- A cross-sprint link is a line running DOWN the column, from a card in sprint row N to a card in
  row M. It is not a left-to-right arrow across columns.
- A same-sprint tether is a short link between two cards in the same vertical list.
Any reference image showing horizontal swimlane arrows (Aha-style PI boards) is mood, not layout.
Design slice 2 to the vertical stack. (If we ever want a horizontal program board, that is a separate,
larger board-orientation brief, not this slice. OUT OF SCOPE here.)

GOAL
Give the board its first drawn layer. Render the dependency relationships created in slice 1 directly
on the board: an always-visible tether for a pair whose endpoints share a sprint, a cross-sprint
connector shown on select/hover, and a board-side RED treatment on the card and the connector when a
pair is a violation. This is a PURE VIEW over the slice 1 model: it consumes deps, isViolation,
storyLocation and the violation flag already carried on depBadges, adds one pure selector and one
view module, and adds NO action and NO schema change. After this slice the facilitator sees the plan's
dependencies on the board as they drag, and an out-of-order pair turns red on the board, not only in
the editor.

WHY THIS SLICE, AND WHAT IT INHERITS
Slice 1 (Brief 7) shipped the model, the card-editor section and picker, the neutral shared D badge,
and the violation feedback INSIDE the editor row. It deliberately drew no SVG and added no board-side
red. This brief is the half that was split away: the drawing. Everything it needs is ready-made and
confirmed in the live source (build-state-after-brief7.md):
- deps is a top-level array of directed pairs { id, blockerId, blockedId }, blocker = do-first,
  blocked = dependent.
- isViolation(state, dep) is pure and clock-free: true only when BOTH endpoints are in sprints AND the
  blocked story's sprint index is strictly less than the blocker's (G7). Backlog either side, same
  sprint, or correct order all false. Slice 2 consumes this directly for the board-side red.
- storyLocation(state, storyId) returns { kind: "sprint", index } | { kind: "backlog" } | null, pure,
  no throw. Use it to resolve each endpoint's row.
- depBadges(state, storyId) already carries { label, violation } per touching pair; slice 1 renders
  label only (neutral). Slice 2 turns the badge red when violation is true.
- Every card already exposes data-story = story.id (the single shared storyCard renderer in
  backlog.js), and each .sprint-body exposes data-sprint-index. These are the hit-testing/positioning
  anchors; no DOM change is needed to find an endpoint.
No new model work. This slice is purely the SVG plus the board-side red.

THE SUBTLE CALL (flag hardest here): THE OVERLAY, THE REDRAW, AND THE MEASURE PASS
This is the load-bearing decision of the slice and the reason it is browser-verified, not unit-tested.
Three coupled facts from the live render path drive it:
- renderBoard calls board.replaceChildren() on EVERY render. The whole board DOM is torn down and
  rebuilt on every store dispatch. So any SVG drawn inside the board is destroyed every render and
  must be redrawn as the LAST step of renderBoard (or as a sibling the render pass refreshes). Card
  element references go stale every render; the connector layer must re-query endpoints by
  [data-story] after layout, never cache nodes.
- Nothing scrolls internally. Neither .workspace nor .board has overflow or a height cap; the board
  grows to content height and the PAGE scrolls. This is the easy case: an SVG sized to the board's
  content box and positioned over it scrolls with the page for free. There is NO internal scrollport
  to sync and NO zoom (do not build for either).
- Hover/select state cannot live in the store and cannot survive replaceChildren. There is precedent
  for view-only state held outside the store: backlog.js holds a module-level collapsed Set; banner.js
  holds dismiss state. The connector layer holds its own selected/hovered story id the same way.

PROPOSE: the overlay home and the redraw model. My lean is an <svg> child appended to #board (set
#board position: relative) as the last node of renderBoard, sized to the board's scroll box, drawn
from a single post-layout measure pass that reads each endpoint's rect RELATIVE to the board box (so
coordinates are board-local and scroll-independent). The SVG is pointer-events: none except for the
hoverable connector paths. A hover or select change redraws ONLY the SVG layer (cheap), not the whole
board. At this scale (max ~12 sprints, tens of cards) a full connector redraw per render is fine. Do
NOT refactor renderBoard away from replaceChildren into a diffing renderer to optimise this; that is a
rabbit hole and an explicit non-goal.

RULINGS BAKED INTO THIS BRIEF (director-ruled R1 to R8, do not silently change)
- R1 THE BOARD DRAWS, IT NEVER CREATES OR EDITS A LINK. Links are created and removed only in the card
  editor (Journey 4 sign-off, carried from Brief 7 R2). The board has NO link affordance: no
  hover-to-link, no click-to-connect, no board-side remove. It renders badges, tethers, connectors and
  red, and nothing else touches deps.
- R2 PURE VIEW, NO ACTION, NO SCHEMA CHANGE. The slice adds one pure selector and one view module. It
  dispatches nothing. The store, the action vocabulary (17), and the schema (v2) are untouched.
- R3 CONNECTORS DRAW ONLY BETWEEN TWO SPRINT-PLACED ENDPOINTS. A pair with EITHER endpoint in the
  backlog draws NO connector and NO tether (it is neutral per G7, and the backlog is a separate panel;
  cross-panel lines add no planning value). The neutral D badge already carries the link's existence
  into the backlog. The SVG lives entirely inside the board grid.
- R4 TETHER ALWAYS VISIBLE; CROSS-SPRINT CONNECTOR ON SELECT/HOVER. A pair whose endpoints share one
  sprint draws an always-visible tether. A pair spanning two sprints draws its connector only when one
  of its cards is selected or hovered (Journey 4: arrows render on the board; keeping cross-sprint
  arrows on-demand keeps a busy board readable). PROPOSE the exact select/hover gesture and whether a
  selected card pins its connectors until deselect.
- R5 BOARD-SIDE RED ON VIOLATION, AND OFF THE CAPACITY ELEMENTS. When isViolation is true, the red
  treatment reads on the CARD (border/badge) and the CONNECTOR stroke. Capacity amber/red stays on the
  pill and the honesty banner. The two semantics never share an element, so a violating card inside an
  over-capacity sprint is unambiguous (the pill is capacity-red; the card/connector is violation-red).
  This is the conscious resolution of the "red is reserved for capacity" note in plan.css, which slice
  1 already bent for the editor-row violation. PROPOSE the exact card and connector red treatment.
- R6 VIEW STATE LIVES OUTSIDE THE STORE. Selected/hovered story id is module-level in the connector
  view, like backlog collapse and banner dismiss. Never dispatched, never in the store, reset on its
  own terms. A re-render must not lose nor leak it.
- R7 CONNECTORS HIDE DURING DRAG, REDRAW ON DROP. Dragula dims the source and flies a mirror; main.js
  already wires the drag lifecycle. A connector to a mid-drag card would be stale, so hide the SVG
  layer on drag start and redraw on drop (the drop already triggers a render). PROPOSE the exact hook
  into the existing dragula events.
- R8 THE NEUTRAL BADGE STAYS; IT GAINS RED ON VIOLATION. The slice 1 neutral D badge (plum/ink)
  remains. depBadges already carries the violation flag per badge; this slice renders that flag as the
  red badge treatment. No badge identity change, no renumbering change (still derived).

ARCHITECTURE CONSTRAINT (non-negotiable, RoE quality gate)
- The "which lines exist" logic is a PURE, DOM-free, unit-tested selector built and tested BEFORE the
  SVG. Only the pixel measurement and the SVG drawing are browser-verified, the same boundary Brief 3
  kept the drag gesture on and Brief 6/7 kept the prompt and picker DOM on.
- The view never mutates state. It reads deps/isViolation/storyLocation and draws. No dispatch.
- No new clock read. Connectors carry no time. todayISO/nowISO stay the only two boundary clock reads.
- One new view module and one new pure selector only. No change to the store, actions, schema,
  validatePlan, or the storyCard signature (the badge already takes the slice 1 badges param).
- Reuse the existing render pass, the existing data-story/data-sprint-index anchors, and the existing
  token set. Do not fork renderBoard or storyCard.

THE PURE CORE (build and unit-test FIRST, DOM-free)
PROPOSE the module home and exact names; a dedicated function in dep-selectors.js (alongside the slice
1 selectors) is the natural home. Likely contents:
- connectorsToDraw(state) returns the drawable set: one entry per pair with BOTH endpoints in sprints,
  e.g. { dep, blockerId, blockedId, fromIndex, toIndex, kind: "tether" | "connector", violation } where
  kind is "tether" when fromIndex === toIndex and "connector" otherwise, and violation is isViolation.
  Pairs touching the backlog are EXCLUDED (R3). This is the whole testable surface; the view consumes
  it and only measures pixels.
Anything with branching (the both-in-sprints filter, the tether-vs-connector classification, the
violation flag) is unit-tested with real plan states, not eyeballed. The pixel geometry
(getBoundingClientRect relative to the board box, the curve path) is browser-only and not unit-tested.

WIRING (the selector, the view module, the render hook, the drag hook, the badge red)
- Selector (dep-selectors.js): add connectorsToDraw(state) as above, pure and exported. No change to
  the slice 1 selectors.
- View module (PROPOSE the name, e.g. connectors.js): owns the SVG overlay and the module-level
  selected/hovered id. Exposes a draw(state) called at the end of renderBoard, and a lightweight
  redraw on hover/select that touches only the SVG. It re-queries endpoints by [data-story] and
  measures relative to the #board box.
- Render hook (render.js): #board gets position: relative; renderBoard appends/refreshes the SVG layer
  as its LAST step, after all sprints and cards are in the DOM, then calls the connector draw.
- Drag hook (main.js): on the existing dragula drag start, hide the SVG layer; on drop, the render
  already redraws it (R7). PROPOSE the minimal change to the existing wiring.
- Badge red (backlog.js storyCard + plan.css): the badge already receives { label, violation };
  render the red treatment when violation is true (R8). PROPOSE whether this is a class on the existing
  .dep-badge or a modifier.

UI (the tether, the connector, the board-side red; everything else deferred)
- Tether (same sprint, always visible): a short link between the two cards in one .sprint-body.
  PROPOSE the visual; lean is a thin neutral curve that does not bisect card text.
- Connector (cross sprint, on select/hover): a curved line from the card in one sprint row to the card
  in another, bowed into a consistent side gutter so it never runs through a card's text. PROPOSE the
  routing side and the curve. A small arrowhead at the dependent (blocked) end reads direction.
- Board-side red (R5): on violation, the card border and the D badge take the red treatment and the
  connector stroke is red, distinct from the capacity pill/banner red.
- Neutral colour (PROPOSE): the neutral tether/connector stroke should NOT be plum (plum is the
  selection/accent and the badge) and must not be amber/red (capacity/violation). Lean is a soft
  neutral line token (e.g. --soft / --line2 family) or a dedicated --tether token, promotable later.
  Confirm the neutral stroke colour and weight.

OUT OF SCOPE (parking lot; do not "while we're here" these, RoE anti-pattern)
- Backlog connectors or any board-to-backlog line (R3). The backlog shows only the neutral badge.
- Board-side create/edit/remove of links (R1); any board affordance to make a dependency.
- Zoom, pan, or a board scrollport (none exists; do not invent it).
- The export warnings / over-commitment section (P0 #6, the next brief). This slice draws on the board;
  the export consumer of isViolation is built in #6.
- Cycle detection (deferred by ruling).
- A horizontal/swimlane board re-orientation (a separate, larger board brief, not this slice).
- Refactoring renderBoard away from replaceChildren into a diffing renderer "for performance".
- Stretch toggle, labels, parked lane, stats strip (P1); sub-1280px backlog drawer; dark mode;
  persistent New-plan control; multiple boards (P2).

ASSERTED CASES (assert these exact outcomes; derive the rest; tests assert real values)
Build fixtures as real plan states (two stories placed in different sprints; two in the same sprint;
one placed and one in the backlog; a violating pair). Pure selector:
1. BOTH-IN-SPRINTS DRAWS. connectorsToDraw on a pair with both endpoints placed in different sprints
   returns one entry with kind "connector" and the correct fromIndex/toIndex.
2. SAME-SPRINT IS A TETHER. A pair with both endpoints in the SAME sprint returns one entry with
   kind "tether" (fromIndex === toIndex).
3. BACKLOG EITHER SIDE DRAWS NOTHING. A pair with either endpoint in the backlog yields NO entry
   (excluded, R3, G7).
4. VIOLATION FLAG MATCHES isViolation. A pair whose blocked story sits in an earlier sprint than its
   blocker returns violation true; correct order returns false; same sprint returns false.
5. ORDER AND DIRECTION. For { blockerId: B, blockedId: A }, the entry records which id is the
   dependent (blocked) end so the view can place the arrowhead; fromIndex/toIndex resolve from
   storyLocation.
Browser-verified, not unit cases:
- A same-sprint pair shows its tether on the board with no interaction (always visible).
- A cross-sprint pair shows no connector at rest; selecting or hovering one of its cards renders the
  connector; leaving/deselecting hides it (R4).
- A violating cross-sprint pair renders the connector and both cards in the red treatment, AND the
  D badge red, with the capacity pill/banner colour unaffected (R5).
- Dragging a card hides the connector layer; dropping it redraws connectors against the new position
  (R7); a move that changes a pair from in-order to out-of-order flips it to red on the next render.
- Deleting a story (card editor) removes its connectors and tethers with the pair (slice 1 prunes the
  pair; the view simply has nothing to draw); no console error.
- The board offers NO way to create or remove a link; the card editor remains the only home (R1).
- Returning a placed dependent to the backlog (duration shrink) drops its connector and clears the red
  to a neutral badge (G7), no data loss, no console error.
- Zero console errors across the above.

HOUSEKEEPING (carry-forward, still NOT actioned this brief; record as remaining open)
- Theme-token promotion still open: promote --plum / --plumwash, #glyph-plan, and the 8 epic-palette
  tokens to shared instrument-core; register plan as a SURFACE in the theme manifest.mjs and add the
  check-theme-drift test. If this slice adds a --tether (or similar) neutral connector token, fold it
  into the same promotion. Suite-level, out of scope for a feature brief.
- Dragula vendoring decision stands (docs/housekeeping-dragula-vendoring.md): keep per-app copies. No
  action.
- Doc/code naming note from Brief 6 still stands: extractPlan's upload mode is "file" in code.
- Two notes logged in build-state-after-brief7.md remain open and are NOT actioned here: validatePlan's
  duplicate check is directional (a reverse pair is a deferred cycle, not a duplicate), and validatePlan
  does not shape-guard each deps element (deps: [null] would throw rather than fail cleanly). The
  natural home for the deps-element guard is the Exports brief (P0 #6), which already touches the I/O
  surface. Neither is a drawing concern; do not bolt either onto this slice.

BRANDING
instrument-core tokens, data-app="plan". Selection and focus use the plum accent and :focus-visible
rings; the D label is IBM Plex Mono. The neutral tether/connector stroke is a soft neutral colour
(PROPOSE), never plum and never amber/red. Board-side violation uses the existing --red/--redwash and
is distinct from the capacity pill/banner (R5). Minimum 13px body, mono labels/numbers 12px+.

DEFINITION OF DONE
- connectorsToDraw is pure, DOM-free, and unit-tested with real states: both-in-sprints draws (1),
  same-sprint is a tether (2), backlog either side draws nothing (3), the violation flag matches
  isViolation across order/same-sprint/backlog (4), and direction/order resolve correctly (5).
- One new view module owns the SVG overlay and its own selected/hovered state outside the store (R6);
  renderBoard draws the layer as its last step over the existing board DOM; a hover/select redraws only
  the SVG, not the board.
- Tethers are always visible for same-sprint pairs; cross-sprint connectors show on select/hover (R4);
  the board draws only between two sprint-placed endpoints (R3).
- Board-side red reads on the card, the badge, and the connector when isViolation is true, and stays
  OFF the capacity pill and banner (R5). The neutral badge from slice 1 is unchanged at rest (R8).
- The board creates/edits/removes NO link; the card editor remains the only home (R1). No new action,
  no schema change, no store change, no storyCard signature change (R2).
- Connectors hide during drag and redraw on drop (R7); no stale line, no console error.
- Verified in the browser against Screen 1 (badges always visible) and Journey 4 (arrows/tethers on
  the board, links edited only in the editor), zero console errors.
- I can explain every line. Build-log entry drafted (AI drafts, I sign off). The handoff note for the
  next brief records that the dependency feature is now complete end to end (model, editor, badge,
  board layer, board-side red), and that P0 #6 (Exports) inherits a finished isViolation and the
  over-commitment figures from Brief 4's overBy.

Start by PROPOSING: the connectorsToDraw shape and its exact module home and name; the overlay home
and redraw model (SVG child of #board vs sibling; the post-layout measure pass relative to the board
box; the hover/select redraw that does not rebuild the board); the connector and tether visuals and
the routing/gutter side; the neutral stroke colour/token and the board-side red treatment on card,
badge and connector; the select/hover gesture and whether selection pins connectors; and the minimal
hook into the existing dragula drag lifecycle for hide-on-drag. No feature code yet.

SUGGESTED NEXT BRIEF
Brief 9 = Exports (P0 #6): the markdown / printable-HTML / CSV plan summary with the dedicated
over-commitment section, consuming Brief 4's overBy and the now-complete isViolation for the
dependency-violation warnings. With slice 2 done, the dependency feature is complete and Exports is the
last untouched P0. (Suggestion only; scope order is the director's call.)
