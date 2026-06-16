PHASE 2 BUILD 3: standalone post-launch slices — one-click demo + clear (#7), plan-capacity bar (#8), return a placed story to the backlog (#9)

Read first: docs/build-state-after-phase2-build2.md (current ground truth — multiplayer LIVE, deps draw and the arrowhead now points at the depended-on story), docs/sprintplan-mvp-spec.md (P1 "stats strip: total points planned vs total capacity"; P0 #3 placement), docs/aide-rules-of-engagement.md, docs/demo-data.md (the sample plan and the CURRENT manual demo/clear flows this build makes one-click), and the live source these slices touch:
- public/js/main.js (boot, the settings handlers, the two delegated click listeners, the import pipeline, autosave, the resume prompt) — the main wiring surface for #7 and #9
- public/js/render.js (renderSettingsStrip, renderBoard, render) — where #8 renders
- public/js/board-selectors.js (sprintPlacedPoints, planSummary) — the points authority #8 reuses
- public/js/plan-maths.js (sprintCapacity, pillState, overBy) — the capacity authority #8 reuses
- public/js/plan-io.js (extractPlan/migratePlan/validatePlan/exportPlan) — the load pipeline #7 reuses
- public/js/backlog.js (storyCard, the SHARED card renderer) — touched by #9 if the on-card option is chosen
- public/js/drag.js (the dragula moves/accepts wiring) — touched by #9 for the drag-handle exclusion
- server/rooms.js (the 9-op allow-list) — the reason #7 is local-only and #9 is room-safe
- public/index.html (the topbar .tbacts, the #settings-strip, the .workspace) — where the new controls and bar mount
- public/css/plan.css (plan-local styles — ALL new CSS lands here)

RoE cadence applies: PROPOSE before you build. No feature code until David approves the approach. Branch feat-phase2-build3-standalone-slices off main (after PR #28 merges, so the dep-selectors.js JSDoc fix is on main first).

CONTEXT
These are the three "standalone slices" from the post-launch UAT backlog, sequenced as phase2-build3 in the build-state. They are deliberately small, independent, and additive. The headline fact, confirmed against the live reducer and the room op-loop: all three ship with NO new action, NO schema change, NO reducer change. The Phase 2 arc's R2 discipline (the model is sealed) holds straight through.

- #7 one-click demo + clear. The flows already EXIST manually (docs/demo-data.md): demo = Import board then pick sample-plan.json; clear = reload then "Start new plan". This slice promotes both to one-click toolbar buttons that reuse the already-tested paths.
- #8 plan-capacity bar. A whole-plan gauge under the settings strip: total placed points vs total plan capacity. A pure derived view, the same shape as the honesty banner (it derives from tested functions, so it cannot disagree with them).
- #9 return a placed story to the backlog. MOVE_STORY to a backlog target already exists and already syncs in a room. This slice adds a non-drag, one-click affordance to send a placed card back without precise dragging.

GROUND-TRUTH FINDINGS (source-checked; confirm at PROPOSE)
1. The room op allow-list (server/rooms.js) is exactly 9 ops: ADD_EPIC, EDIT_EPIC, DELETE_EPIC, ADD_STORY, EDIT_STORY, DELETE_STORY, MOVE_STORY, LINK_DEP, UNLINK_DEP. MOVE_STORY is in it, so #9 works in a room with zero server change. NEW_PLAN and LOAD_PLAN are NOT in it, so a demo-load or clear in a room would be nack'd ("op type not allowed"). #7 is therefore LOCAL-MODE ONLY and its controls hide in a room, exactly as the Collaborate button already does (main.js: `if (IN_ROOM) collabBtn.hidden = true`).
2. The demo file is a self-identifying FILE envelope built from the real reducers (samples/build-sample-plan.mjs writes public/samples/sample-plan.json via exportPlan). So the demo button can reuse the exact Import pipeline: extractPlan(parsed, "file") then migratePlan then validatePlan then loadPlan(normalise). One tested boundary, no second load path.
3. The demo holds 34 stories in the BACKLOG with nothing placed. Loading it does not by itself trigger any capacity warning (the bar reads 0 placed until the user drags). That is intended (testers place the cards themselves).
4. board-selectors already exposes planSummary(state).placedPoints (total placed points) but NOT a plan-level capacity. #8 needs one new pure function: the sum of sprintCapacity across sprints (which already prorates partial sprints).
5. storyCard(story, epic, badges) in backlog.js is the SHARED renderer for both the backlog panel and the board. epic-presence is NOT a reliable board-vs-backlog signal (a No-epic placed card is rendered with epic=null too), so #9's on-card option needs an explicit flag, not an inferred one.

GOAL
Three independent, shippable slices:
- #7: a "Load demo" and a "Clear plan" control in the top bar, each one click, each reusing a tested path, each guarded against silently destroying real work, both hidden in a room.
- #8: a slim plan-capacity bar under the settings strip showing total placed points vs total plan capacity, its over/under state derived from the same tested functions as the pill, so it can never disagree with them.
- #9: a one-click "return to backlog" affordance on a placed card (or, fallback, in the card editor), dispatching the existing MOVE_STORY, correct in local and room mode, stable across drag.

No model, schema, action, or reducer change in any slice (R-sealed-model). No report/export change. No connector/board-geometry change.

---

## SLICE 3a — one-click demo + clear (#7)

RULINGS
- 3a-R1 REUSE THE TESTED PATHS. Demo-load reuses the Import pipeline verbatim: fetch /samples/sample-plan.json, then the SAME extractPlan("file") then migratePlan then validatePlan then loadPlan(normalise) sequence the file-import handler already runs. Clear reuses the resume prompt's "Start new" path: newPlan(nextMonday(todayISO())). No new pure logic.
- 3a-R2 LOCAL ONLY, HIDDEN IN A ROOM. NEW_PLAN/LOAD_PLAN are not room ops (finding 1). Both controls hide when IN_ROOM, like Collaborate. They are never dispatched in a room.
- 3a-R3 NEVER WIPE WORK SILENTLY. Both actions REPLACE the whole plan. When the current board has user content (any epics or any stories), the action is gated behind a confirm. When the board is empty/fresh, skip the confirm (there is nothing to lose).
- 3a-R4 RE-ARM THE BANNERS. A whole-plan replace can leave a stale dismissed-banner set keyed by sprint index. Both actions call clearDismissedBanners() before dispatch, the same guard the settings handlers use.

THE WORK (PROPOSE the specifics)
- Two top-bar buttons (placement to confirm at PROPOSE: alongside Download/Import in .tbacts reads naturally). Demo = btn-ghost "Load demo"; Clear = btn-ghost "Clear plan".
- Demo handler: fetch the sample, run the Import pipeline, loadPlan(normalise(plan)), flash "Demo plan loaded." A fetch or pipeline failure flashes a clear reason and changes nothing (atomic, like Import).
- Clear handler: confirm if non-empty, then clearDismissedBanners() + dispatch newPlan(nextMonday(todayISO())), flash "Cleared to a new plan."
- Confirm mechanism: PROPOSE custom modal (on-brand, reuses modal.js) vs window.confirm (cheapest). Recommend a minimal modal for suite consistency.
- Recommend factoring the file-import body in main.js into a shared loadParsedPlan(parsed, mode) helper so the demo button and the file import run one identical path.

ASSERTED CASES (mostly browser; the pure boundary is already covered)
1. (unit) public/samples/sample-plan.json passes the load boundary: extractPlan(parsed,"file") then migratePlan then validatePlan all return ok. This is a cheap regression tripwire if the schema bumps again.
2. (browser, local) Load demo on an empty board fills the backlog with the sample (no confirm shown); autosaves; survives reload.
3. (browser, local) Load demo on a NON-empty board shows the confirm; cancelling changes nothing; confirming replaces the board.
4. (browser, local) Clear plan on a non-empty board confirms, then leaves a single empty default plan; reload shows the empty plan (not the old one).
5. (browser, room) Both controls are hidden when the URL has ?room=; neither can be dispatched there.
6. A failed demo fetch (rename the file) flashes a reason and leaves the board untouched.

---

## SLICE 3b — plan-capacity bar (#8)

RULINGS
- 3b-R1 PURE DERIVED VIEW. The bar derives from tested functions only. One new pure selector: planCapacity(state) = sum over sprints of sprintCapacity(sprint, settings) (which already prorates the partial final sprint). Planned reuses planSummary(state).placedPoints (the single points authority; do not re-sum by hand). It dispatches nothing.
- 3b-R2 CANNOT DISAGREE WITH THE PILL MATHS. The bar's over/under state is pillState(planned, capacity), the same tested function the sprint pills use. Plan-level thresholds are therefore the same as sprint-level (at/under neutral, up to 10% over amber, more than 10% red). Confirm this thresholds-reuse at PROPOSE; the alternative (a bespoke plan-level threshold) would reintroduce exactly the "two thresholds disagree" risk the banner pattern exists to kill.
- 3b-R3 PLACED IS THE FILL. "Planned" is placed points (what sits in sprints). Backlog is unplanned. PROPOSE whether to annotate backlog points as a muted secondary label (the demo loads 124 backlog pts against ~108 capacity, so an annotation makes the bar informative before anything is placed). Core bar is placed-vs-capacity; the backlog annotation is optional.

THE WORK (PROPOSE the specifics)
- New pure selector planCapacity(state) in board-selectors.js, unit-tested.
- New renderPlanBar(state) in render.js, called from render(); mounts into a new element under #settings-strip (e.g. #plan-bar), before .workspace, in index.html.
- Visual: PROPOSE a fill bar (proportion = planned/capacity, clamped, overflow shown distinctly) vs a text-only "Planned X / Y pts" line. Recommend a slim fill bar with the mono X / Y figure, reusing the pill's existing amber/red wash tokens for the over states. No new token; plum stays the interaction accent.
- Partial sprints are already prorated inside sprintCapacity, so summing is correct with no special case.

ASSERTED CASES (TDD the selector first)
1. planCapacity of a 2-sprint plan, both full, velocity 20 buffer 10 (adjusted 18 each) = 36.
2. planCapacity of a plan whose final sprint is partial includes the PRORATED figure for that sprint, not the full 18 (build the plan from the real generator; assert the prorated sum).
3. Bar state equals pillState(planned, planCapacity) at the boundaries: planned 36 of 36 = neutral; planned 39 of 36 (3 over = 8.3%) = amber; planned 40 of 36 (4 over = 11.1%) = red. The bar colour must be derived from pillState, not a parallel rule.
4. (browser) On a fresh plan the bar reads 0 / capacity neutral; after placing stories it tracks the sprint pills; an over-plan turns the bar amber then red in lockstep with the threshold.

---

## SLICE 3c — return a placed story to the backlog (#9)

RULINGS
- 3c-R1 NO NEW ACTION. The move is the existing MOVE_STORY with target { kind: "backlog" }, beforeId null. It already conserves the id and already broadcasts in a room (MOVE_STORY is allow-listed). This slice is view wiring only.
- 3c-R2 MANUAL MEANS NO TOAST. A user-initiated return is a manual move, so it sets lastReturnedStoryIds: [] (it already does) and fires no "returned to backlog" toast. Only a settings-regeneration return toasts (G3). Landing position: append to the backlog end (beforeId null), so in the grouped panel the card lands at the bottom of its epic group.
- 3c-R3 NO DRAG INTERFERENCE. If the affordance is on the card, a mousedown on it must NOT start a dragula drag, and the trailing click must not open the editor (the #board listener already guards isDragging).

THE WORK (PROPOSE the affordance — this is the main decision)
- Option A (recommended, the one-click intent): a small "return" control on the placed board card. Add an explicit optional flag to storyCard (e.g. placed: boolean, default false) so ONLY board-rendered cards get the control; backlog calls are unchanged (default false). The control carries data-act="return-to-backlog" + data-story; main.js's #board listener gets a case that dispatches MOVE_STORY to backlog. drag.js's moves() excludes the control as a handle (return false when the mousedown handle is inside [data-act="return-to-backlog"]) so grabbing it never starts a drag.
- Option B (fallback, lowest risk): a "Return to backlog" button in the card-editor footer, shown only when storyLocation(state, id).kind === "sprint" (card-editor already imports storyLocation). Click dispatches MOVE_STORY to backlog then closes. One file plus CSS, no shared-renderer or drag change, but two clicks not one.
- Recommend A for the one-click UAT intent, with the drag-handle exclusion and isDragging guard as asserted cases. B is the clean fallback if the shared-renderer or drag edge is judged not worth it.

ASSERTED CASES
1. (unit, likely already covered in store-move.test.js) MOVE_STORY of a placed story to backlog conserves the id (appears once, in backlog, removed from its sprint) and sets lastReturnedStoryIds: [] (no toast).
2. (browser, local) Clicking return on a placed card moves it to the backlog bottom of its epic group; no toast fires; the sprint pill and the plan bar (3b) both drop accordingly.
3. (browser, option A) Pressing on the return control does NOT start a drag; the trailing click does NOT open the editor; a normal click elsewhere on the card still opens the editor.
4. (browser, room) In a two-client room, returning a placed card removes it from the sprint for both clients (MOVE_STORY round-trips); no nack.

---

OUT OF SCOPE (parking lot; do not "while we're here")
- Demo/clear inside a room (3a is local-only by ruling; the controls hide there). Do not add NEW_PLAN/LOAD_PLAN to the room op-loop.
- The animated/elastic connector that stretches WHILE dragging (Brief 8 R7 deliberately hides on drag, redraws on drop). Still deferred.
- The collaboration-polish cluster (mandatory name-on-join gate, re-open the share link after first use, a show-piece room name on the board, presence moved to a left rail). That is a later build, the director's alternative sequence.
- Any model / schema / action / reducer change; any change to connectorsToDraw, the deps shape, or the board geometry.
- Cycle detection (still deferred by ruling: self-dep + duplicate-pair rejected at the picker and the load boundary; a true cycle yields honest mutual violation flags, no DFS).
- Report/export changes (P0 #6 is shipped and untouched here).

HOUSEKEEPING (carry-forward, NOT actioned here)
- The dep-selectors.js JSDoc comment fix (head-at-blocker convention) was made AFTER PR #27 merged, so it rides its OWN small PR #28, not #27; this branch starts after #28 merges.
- build-state-after-phase2-build1.md still moves to docs/archive/ at the next cleanup.
- Sibling theme re-sync stays OPEN at suite level (signal/retro/poker/raid owe a sync commit after the Brief 10 plum/glyph promotion). Not a plan task.
- @suite/auth-client vendoring for clean redeploys is an open launch follow-up. Not this build.
- Company-level entitlement currently covers just the launcher's user. Open follow-up, not this build.
- Dragula vendoring decision stands (docs/housekeeping-dragula-vendoring.md): keep per-app copies.

BRANDING
No new visual language. Demo/Clear/return controls reuse the existing btn-ghost/btn-pri classes. The plan-capacity bar reuses the pill's existing amber/red wash tokens for its over states; plum stays the interaction accent; amber/red stay reserved for capacity semantics. THEME SOURCE OF TRUTH IS THE SHARED SUITE REPO: do NOT edit instrument-core.css, oscilloscope.js, or glyphs.svg (synced artifacts, the drift gate goes red). All new CSS lands in public/css/plan.css.

DEFINITION OF DONE
- The three slices behave per their asserted cases, verified by David in the browser (local and, for 3c, a two-client room).
- One new pure function (planCapacity) is unit-tested; the bar-state-equals-pillState invariant is asserted (3b). The sample-plan load-boundary case is asserted (3a). MOVE_STORY-to-backlog conservation is covered (3c).
- NO new action, NO schema change, NO reducer change, NO server/op-loop change. The dependency model and the board geometry are untouched.
- Full suite + typecheck + drift green. Fable can explain every line. Build-log entry drafted (AI drafts, David signs off). The handoff note records the three slices as shipped.

Start by PROPOSING, in order: (1) one branch/PR for all three slices (recommended) vs split into 3a/3b/3c; (2) the 3a confirm mechanism and the non-empty predicate, the demo fetch-and-reuse-Import path, and the toolbar placement; (3) the 3b selector shape, the pillState thresholds-reuse, the bar visual, and whether to annotate backlog points; (4) the 3c affordance (Option A on-card vs Option B editor), with the landing-at-backlog-end and no-toast rulings. No feature code until David approves the approach.
