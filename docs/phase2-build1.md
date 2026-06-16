PHASE 2 BUILD 1: Dependencies don't sync in a room — the card editor assumes synchronous dispatch (defect fix)

Read first: docs/sprintplan-mvp-spec.md (P0 #5 "Story-to-story dependency link"; the "zero data-loss" quality bar), docs/build-state-after-brief10.md (the current build-state / ground truth — NOTE it predates the live multiplayer wiring, so where it and the source disagree, the source wins), docs/aide-rules-of-engagement.md, and the live source this fix touches: public/js/card-editor.js (the Dependencies section + the inline new-epic add), public/js/sync-client.js (the pessimistic room store), public/js/main.js (the dual-mode boot + the board's store subscription), server/rooms.js (the op allow-list — read only, to confirm no change is needed). Brief 7 and Brief 8 (the dependency model + board layer) now live in docs/archive/ if you want the original context. RoE cadence applies: PROPOSE before you build. No feature code until David approves the approach. Feature branch per build (feat-phase2-build1-deps-room-sync). Branch off main.

CONTEXT (the bug, found by source-grounding, not by guesswork)
A facilitator in a SHARED ROOM opens a story, clicks "This needs…" / "This blocks…", picks a target — and nothing happens. No row, no badge, no link to remove. The dependency feature looks completely dead in a room. It is NOT dead: it works in the local single-user app. Only the ROOM path of the card editor is broken. A first guess that the room op allow-list was missing LINK_DEP/UNLINK_DEP was checked against server/rooms.js and is WRONG: both ops are in the allow-list. The defect is in the view, not the sync protocol.

ROOT CAUSE (precise)
The room store is PESSIMISTIC by design (sync-client.js, MP1 R1): dispatch SENDS an op and does NOT mutate local state; the store changes only when the server echoes the applied op back. The card editor's Dependencies section was written against the LOCAL store, which mutates synchronously. Two consequences in a room:

1. buildDependencies → openPicker → on select does:
       store.dispatch(linkDep(payload));
       picker.hidden = true;
       renderRows();
   renderRows() reads store.getState() the instant after dispatch. In a room the link is still in flight to the server, so the editor renders the OLD state and shows "No dependencies yet". The user sees nothing.

2. The Dependencies section never SUBSCRIBES to the store. When the server echo lands and the store notifies, the open modal does not re-render. The board does (main.js: store.subscribe(paint)), so a D badge most likely appears on the board behind the modal, but the editor never reflects the link. The remove control (dep-remove) has the identical renderRows()-after-dispatch flaw.

A SIBLING instance of the same assumption: the inline "+ New epic" add (newEpicAdd → store.dispatch(addEpic(...)); refreshEpicOptions(action.payload.id)) reads back immediately, so a room-created epic will not appear in the select either.

The whole defect is this: the card editor reacts to the RETURN of dispatch instead of reacting to store NOTIFICATIONS. Correct under the synchronous local store, wrong under the pessimistic room store.

GOAL
Make the card editor correct under BOTH stores with ONE code path. A dependency created or removed in a room must appear/disappear in the editor (and on the board) for every participant, exactly as it does locally. No change to the shipped model, actions, schema, validatePlan, reducers, the server op loop, or the board/connector layer. This is a VIEW-LAYER fix in card-editor.js (plus, at most, a one-line unsubscribe hook in modal.js).

RULINGS (R1–R5, do not silently change)
- R1 REACT TO NOTIFICATIONS, NOT TO DISPATCH RETURN. The Dependencies section (and the new-epic options) re-render from a store subscription, never from a synchronous read after dispatch. Identical code must hold under the pessimistic room store AND the synchronous local store (MP1 R2: the view cannot tell which store it holds).
- R2 NO MODEL/ACTION/SCHEMA/REDUCER/PROTOCOL CHANGE. linkDep/unlinkDep, the deps shape, validatePlan, the reducers, and the server op loop are correct and untouched. The room allow-list already includes LINK_DEP/UNLINK_DEP. This is not a sync change.
- R3 NO BOARD/CONNECTOR CHANGE. The board already re-renders on notify and the connectors/tethers (Brief 8) already draw from state. Do not touch render.js or connectors.js. Once links create correctly, the board layer comes good for free.
- R4 LOCAL MODE IS UNCHANGED IN BEHAVIOUR. After the fix the local single-user app behaves exactly as today (create/remove a link, see the row and badge instantly). No regression to the local path.
- R5 SUBSCRIPTION LIFECYCLE IS CLEAN. Any store subscription the editor adds MUST be torn down when the modal closes. A reopened editor must not stack subscribers or double-render.

THE FIX (PROPOSE the exact mechanism)
The defect is localised to buildDependencies (and the small new-epic spot) in card-editor.js. PROPOSE the cleanest of:
- (lean) Subscribe the Dependencies section to the store inside buildDependencies: renderRows() runs on every store notification; the link/unlink dispatch sites DROP their synchronous renderRows() and let the notification drive the re-render. The picker still hides optimistically on select (a UI affordance, not state). Wire an unsubscribe into modal close so it cannot leak (R5).
- (alt) Re-render the whole editor body on notify. Heavier; the targeted section subscription is simpler.
For the new-epic sibling: refreshEpicOptions should also run from the subscription (or re-read on notify) so a room-created epic appears in the select.

Confirm the UX: the picker hides immediately on select (good), but the ROW/BADGE appears only when state confirms the link (correct under both stores). In local mode the notification is synchronous, so it still feels instant.

VERIFY, DO NOT ASSUME (a possible second-order nack)
The root cause above fully explains the modal symptom. It does NOT, on its own, prove the op round-trips server-side without a validatePlan nack. The two-client test below will surface any residual server nack. If, WITH the editor fix in place, the badge still never reaches browser B, STOP and report — that is a separate server-side finding, not this fix, and must not be papered over.

ARCHITECTURE CONSTRAINT (RoE quality gate)
- View-layer only. No new action, no schema change, no reducer change, no selector change. card-editor.js is the changed file (plus, if needed, a one-line unsubscribe hook in modal.js).
- No new clock read. todayISO/nowISO stay the only two boundary clock reads.
- The view never mutates state; it dispatches the existing actions and reads via the existing selectors.
- One code path for local and room mode.

ASSERTED CASES (assert real outcomes; browser-verified where the boundary is DOM/sync)
Local (regression — must stay green):
1. In the LOCAL app, creating a dependency shows the editor row and the D badge on both cards; removing it clears both. The shipped feature is whole; the fix does not regress local.
Room (the defect — two real clients in one room):
2. In a shared room, browser A creates a "needs" link to another sprint-placed story: A's editor shows the new row, AND both A and B show the D badge on the board (the op round-tripped and both stores reduced it).
3. The cross-sprint connector / same-sprint tether (Brief 8) draws on the board for both A and B once the link exists (no board-layer change; it comes good once the link creates).
4. The remove control in A's editor removes the link; the row disappears in A and the badge disappears on the board for both A and B.
5. A room-created inline "+ New epic" appears in the editor's epic select for the creating client (the sibling fix).
6. Reopening the card editor several times in a room does not stack subscriptions (no duplicate re-renders; clean unsubscribe on close, R5).
7. Zero console errors across the above.

OUT OF SCOPE (parking lot; do not "while we're here")
- The animated/elastic connector that stretches WHILE a card is dragged (UAT #5). The shipped connectors deliberately hide on drag and redraw on drop (Brief 8 R7). Reversing that is a separate enhancement build and is NOT justified by this defect.
- The other nine UAT items (see the backlog below); each is its own phase2-buildN.
- Any change to the sync protocol, the server op loop, validatePlan, the reducers, or the board/connector rendering.
- Cycle detection (still deferred by ruling).

THE UAT BACKLOG (recorded here so the sequence is not lost; each becomes its own build)
From the UAT session, ten items. This build (phase2-build1) clears the dependency defect, which also unblocks #5 (the draw) and #6 (removal).
- DEFECTS: #4 picker dead in a room (THIS BUILD); #3 joiners all show as "guest" (a mandatory name-on-join gate); #9 no way to return a placed story to the backlog.
- ENHANCEMENTS: #1 re-open the share link after first use; #2 move presence to a new left rail; #7 one-click demo load/clear; #8 plan-capacity bar under the settings strip (points vs total capacity, green/amber/red); #10 a show-piece room name displayed on the board.
- ALREADY SHIPPED — comes good once #4 lands: #5 connectors/tethers draw; #6 the remove-dependency control.
Suggested next builds (order is David's call): phase2-build2 = collaboration polish (name-on-join #3, re-open link #1, room name #10, presence left rail #2); phase2-build3 = the small standalone slices (demo button #7, capacity bar #8, return-to-backlog button #9).

HOUSEKEEPING (carry-forward, NOT actioned here)
- Theme-token promotion is DONE for plan (Brief 10). Sibling re-sync stays a suite-level follow-up, not a plan task.
- Dragula vendoring decision stands (docs/housekeeping-dragula-vendoring.md): keep per-app copies.
- Doc/code naming note (Brief 6): extractPlan's upload mode is "file" in the code.

BRANDING
No new UI surface. The Dependencies section, picker, neutral D badge, and danger-ghost remove control are unchanged in appearance; only their re-render TIMING changes.

DEFINITION OF DONE
- The Dependencies section (and the new-epic options) re-render from a store subscription, not from a synchronous read after dispatch (R1), with a clean unsubscribe on modal close (R5).
- Local create/remove is unchanged (1); a room create/remove round-trips to both clients in the editor and on the board (2, 4); the board connector/tether layer comes good once links create (3); a room-created new epic shows in the select (5); no stacked subscriptions on reopen (6); zero console errors (7).
- No model/action/schema/reducer/selector/protocol change; card-editor.js (and at most a one-line modal.js unsubscribe hook) are the only files touched (R2, R3).
- Full suite + typecheck + drift green; the local path provably unchanged (R4).
- Fable can explain every line. Build-log entry drafted (AI drafts, David signs off). The handoff note records that the dependency feature is now correct in BOTH local and room mode.

Start by PROPOSING: the subscription mechanism for the Dependencies section (subscribe-in-buildDependencies + unsubscribe-on-close vs a modal-level re-render); how the new-epic options pick up a room-created epic; and the unsubscribe hook into modal.js close. Then REPRODUCE (confirm local works, room fails) BEFORE the fix, and lock it with the two-client room test. No feature code until David approves the approach.
