PHASE 2 BUILD 2: Dependency arrowhead points at the line, not the depended-on story (connectors.js direction/anchor defect)

Read first: docs/build-state-after-phase2-build1.md (current ground truth — multiplayer LIVE, deps now sync in a room), docs/sprintplan-mvp-spec.md (P0 #5 "Story-to-story dependency link"), docs/aide-rules-of-engagement.md, docs/archive/brief8.md (the connector/tether design and R1–R7 this fix must respect), and the live source: public/js/connectors.js (the only file expected to change), public/js/dep-selectors.js (connectorsToDraw — READ ONLY), public/css/plan.css (the .dep-layer / .dep-line / #dep-arrow marker styles — READ ONLY unless the fix needs a marker tweak). RoE cadence applies: PROPOSE before you build. No feature code until David approves the approach. Feature branch feat-phase2-build2-connector-arrowhead off main.

CONTEXT (found in the phase2-build1 UAT, parked per the no-"while we're here" rule)
Once dependencies started drawing inside a shared room (phase2-build1), the connector arrowhead was seen to point at the LINE, not at the depended-on story. This is a pre-existing Brief 8 defect, invisible until deps actually drew. Pure view-layer, board-only; the dependency MODEL is correct and untouched. This build does the connector fix and nothing else (the other UAT items are their own builds).

ROOT CAUSE (source-grounded; confirm at PROPOSE with a live render)
Two compounding issues in connectors.js:

1. ANCHOR / ORIENTATION (why it reads as "on the line"). Every path anchors at BOTH cards' RIGHT edges (x1 = from.right, x2 = to.right) and the END control point sits directly right of the endpoint at the SAME y (c2 = Math.min(x2 + bow, maxX), y2). So the cubic's tangent at its end is HORIZONTAL, and with the marker's orient="auto" the arrowhead always points flatly LEFT into the card's right edge — regardless of where the other card actually is (above, below, far away). The head's direction is decoupled from the real blocker→blocked direction, so it reads as sitting ON the curve rather than pointing AT a story.

2. DIRECTION (confirm the convention before moving it). The arrowhead is marker-end at the PATH END = `to` = the BLOCKED (dependent) card. If the intended reading is "this story depends on THAT one", with the head pointing at the depended-on story (the BLOCKER), the head is on the wrong end. Confirm the convention against archive/brief8.md and the screen design BEFORE changing it.

GOAL
The arrowhead visibly points AT the depended-on story — for cross-sprint connectors AND same-sprint tethers, neutral AND violation, in local AND room mode, and stable across drag/redraw. A pure view-layer fix in connectors.js (and, only if the marker geometry needs it, the #dep-arrow marker / .dep-layer CSS). No model / selector / store / schema change.

RULINGS (respect Brief 8 R1–R7; do not silently change)
- R1 PURE VIEW. connectors.js stays a pure view over connectorsToDraw / the carried violation flag. It dispatches nothing and never touches deps, the store, or the schema. dep-selectors.js is READ ONLY and unchanged.
- R2 CONFIRM CONVENTION FIRST. Settle which story the arrow points at (the depended-on / blocker, per the dependency reading) against archive/brief8.md and the screen design BEFORE moving geometry. Getting the semantic right is the prerequisite to the anchor fix; do not guess and reshape in one pass.
- R3 KEEP SHIPPED BEHAVIOUR INTACT. Unchanged: hover-gating of cross-sprint connectors (Brief 8 R4), always-visible tethers, drag suppression + the dragend redraw (R7), violation-red via fill: context-stroke, the single shared #dep-arrow marker, the overlay recreate-on-render lifecycle, and the module-level hover state. Change endpoint / anchor / marker geometry ONLY.
- R4 BOTH KINDS. The fix applies to same-sprint tethers AND cross-sprint connectors; both carry the same marker-end today, so both must come out correct.

THE FIX (PROPOSE the exact geometry)
The defect is localised to curvePath / buildDefs (endpoints, end control point, and the marker) in connectors.js. PROPOSE the cleanest of, for example:
- Anchor each endpoint on the card EDGE that faces the other card, or aim the END control point toward the target card's body, so orient="auto" yields a head that drives INTO the depended-on card rather than flatly along its right edge.
- And/or reverse which end carries marker-end so the head lands on the depended-on (blocker) story.
Keep the right-bowed cubic unless it fights the fix. Confirm with a live two-card render (and a violation pair) before and after.

ASSERTED CASES (browser-verified; the boundary is SVG geometry)
1. For a cross-sprint connector, the arrowhead lands on and points at the depended-on story (per the confirmed convention), not flatly into a right edge or along the curve.
2. Same for a same-sprint tether.
3. A violation pair still draws red (fill: context-stroke) with the corrected head.
4. After dragging a card, and on dragend (including a cancelled drag), the head stays correct (recomputed, not stale).
5. In a shared room (two clients), the corrected head shows for both clients once both endpoints are placed (deps now draw in rooms after phase2-build1).
6. Hover-gating of cross-sprint connectors, always-on tethers, and drag-suppression are unchanged; zero console errors.

OUT OF SCOPE (parking lot; do not "while we're here")
- The animated / elastic connector that stretches WHILE a card is dragged (UAT #5). Brief 8 R7 deliberately hides the layer on drag and redraws on drop; still deferred, and NOT justified by this defect.
- Any model / selector / store / schema change; any change to connectorsToDraw or the deps shape.
- The remaining UAT items (collaboration polish — name-on-join, re-open link, room name, presence rail; and the standalone slices — demo button, capacity bar, return-to-backlog). Each is its own phase2-buildN.

HOUSEKEEPING (carry-forward, NOT actioned here)
- Sibling theme re-sync stays OPEN at suite level (signal/retro/poker/raid owe a sync commit after the Brief 10 plum/glyph promotion). Not a plan task.
- @suite/auth-client vendoring for clean redeploys is an open launch follow-up. Not this build.
- Dragula vendoring decision stands (docs/housekeeping-dragula-vendoring.md): keep per-app copies.

BRANDING
No new UI surface. The connector, tether, neutral colour, and violation-red treatment are unchanged in appearance; only the arrowhead's direction and anchor change so it points at the right story.

DEFINITION OF DONE
- The arrowhead points at the depended-on story for connectors and tethers, neutral and violation, local and room, stable across drag and redraw (1–5); the shipped hover / tether / drag behaviour is unchanged (6).
- connectors.js is the only changed file (plus a #dep-arrow marker / .dep-layer CSS tweak ONLY if the geometry needs it); no model / selector / store / schema change (R1).
- Full suite + typecheck + drift green. Fable can explain every line. Build-log entry drafted (AI drafts, David signs off). The handoff note records that the dependency arrow now points at the depended-on story.

Start by PROPOSING: the confirmed arrow convention (which story the head points at, cited to archive/brief8.md + the screen design), and the anchor / orientation change that makes it point there. Then REPRODUCE the wrong (flat) head on a two-card render BEFORE the fix, and lock it with the browser cases above. No feature code until David approves the approach.
