BRIEF 2 — Backlog panel, epic and story cards (P0 #2)

Read first: docs/sprintplan-mvp-spec.md (v0.5), docs/v1-screen-designs.md (v1.0),
docs/user-journeys.md (v1.0), docs/aide-rules-of-engagement.md, and
docs/build-state-after-brief1.md (what the code actually is now, not just what the
specs say). RoE cadence applies: PROPOSE before you build. No feature code until I
approve the approach.

GOAL
The second vertical slice: the backlog panel and the epic/story cards that fill it.
A facilitator can create epics and child stories (title, summary, points), see stories
grouped under their epic in the right-hand panel, and edit or delete either. This is
P0 #2 and the prerequisite for almost everything after it (DnD, capacity meaning,
dependencies, exports).

Stories live in the BACKLOG ONLY in this brief. They are not placed into sprints yet
(that is drag-and-drop, the next brief). Capacity pills stay 0 / capacity. Dependencies
are not in this brief.

WHAT THIS SLICE EXTENDS (from build-state-after-brief1.md)
The store already reserves the slots: epics {}, stories {}, backlog [] (array of story
ids, front = top), and per-sprint placedStoryIds []. Regeneration already conserves them.
This brief fills those slots for real: it defines the epic and story object schema, the
create/edit/delete actions, the derived backlog view data, and the two editor modals.
It does not invent new architecture; it slots into seams that already exist.

RULINGS BAKED INTO THIS BRIEF (flag if you disagree, do not silently change)
- A story's LOCATION is array membership, never a field. A story id sits in backlog[] or
  in exactly one sprint's placedStoryIds[]. Do not add sprintId or location to the story
  object. This preserves the Brief 1 contract and keeps regeneration honest.
- A story's EPIC is story.epicId (nullable). epicId = null means "No epic", a real bucket
  in the backlog panel, not an error. Grouping is by epicId; ordering is the flat backlog[]
  array.
- Epic colour is stored as a palette KEY (or index), never a raw oklch literal. The theme
  owns the actual colour value so dark mode and token changes stay central. Palette: 6-8
  hues from the instrument family, plum first, assigned by rotation at epic creation,
  changeable in the epic editor (G4).
- DELETE is the only path that removes a story or epic, and it is always user-initiated and
  confirmed. No other action reduces story or epic count. This is the first intentional
  delete in the app; treat the zero-data-loss bar as load-bearing here.
- Modal open/closed and dirty-field state is VIEW state, not store state. Do not put editor
  UI state in the single store (not multiplayer-relevant, not persisted). The store only
  hears discrete committed actions on Save and Delete.
- Points are a positive integer (>= 1). Reject 0, negative, and non-integer input. Fibonacci
  chips are shortcuts, not the only allowed values (free positive-integer entry per G5).

ARCHITECTURE CONSTRAINT (non-negotiable, RoE quality gate)
- Single store, discrete named actions, pure reducer. The editors dispatch actions; they
  never mutate state. Autosave already persists every action, so new actions inherit
  persistence for free. Keep it that way.
- The backlog's derived view data (per-epic story count and unplaced points, the No-epic
  group, grouping and ordering) is a PURE selector over store state, DOM-free and
  unit-tested, the same pattern Brief 1 used for capacity and the rail. Build and test the
  selectors first, wire the panel and modals second.
- Every delete is atomic in the reducer. No half-state where a story is gone from the map
  but lingers in an array, or vice versa. Assert this.

SCHEMA (the danger zone for this brief is data shape and delete safety; propose the exact form)
PROPOSE the precise object shapes. Required fields and invariants:
- Epic: stable id; title (required, non-empty); colourKey (from the palette). Epics carry
  no story list (grouping is derived from stories, not stored on the epic).
- Story: stable id; title (required, non-empty); summary (optional); points (positive
  integer); epicId (nullable). No location field (see rulings).
- Id strategy: propose it (e.g. short prefixed ids like epic_ / story_). Must be
  serializable and collision-safe within a session; remember ids ride in JSON
  export/import (P0 #7) in a later brief, so do not lean on array position for identity.

ACTIONS — to ADD this brief (match the shipped convention: SCREAMING_SNAKE, { type, payload })
- ADD_EPIC: creates an epic, assigns the next rotation colourKey, surfaces its new id so an
  inline "+ New epic" can select it immediately.
- EDIT_EPIC: title and/or colourKey.
- DELETE_EPIC: payload carries the child-resolution choice: 'reparent' (children -> epicId
  null, zero stories deleted) or 'delete' (children removed from the map AND every array).
  No orphans, no half-state, either way.
- ADD_STORY: title, summary, points, epicId (nullable). New story id appends to the END of
  backlog[] (the TOP is the reserved "returned to backlog" position from G3). Flag if you
  think a different insertion point is righter.
- EDIT_STORY: title, summary, points, epicId. Changing epicId regroups it; it does NOT
  change its position in the flat backlog[] order, and never moves a placed story between
  sprints.
- DELETE_STORY: removes the story from the map and from whichever array holds it (backlog or
  a sprint). Touches no other story.
No MOVE_STORY (drag-and-drop, next brief) and no LINK_DEP (dependencies, a later brief) in
this slice.

SELECTORS / DERIVED VIEW DATA (pure, unit-tested, DOM-free)
- backlogGroups(state): stories grouped by epic in epic order, plus a trailing "No epic"
  group when any unparented backlog stories exist; preserves backlog[] order within a group.
- epicSummary(state, epicId): { storyCount, unplacedPoints } where unplacedPoints sums the
  points of that epic's stories whose id is currently in backlog[]. Everything is unplaced in
  this brief, but compute it correctly now so it is right the moment drag-and-drop lands.
- Render the panel from these selectors only; no ad-hoc state traversal in the view.

UI — Backlog panel (Screen 1, backlog panel section)
- ~280px right panel. Header: "Backlog" + "+ Epic".
- Epic group row: collapse chevron, colour dot, epic title, "N stories · M pts" in mono.
  Click opens the epic editor. "+ Story" button per group.
- Story row: title + points (mono), click opens the card editor. Not draggable yet.
- "No epic" group renders only when it has stories.
- Empty backlog shows the inviting empty state (prompts the first epic).
- Target viewport >= 1280px. The sub-1280 collapsible drawer is OUT of this brief unless it
  is nearly free; note it, do not block on it.

UI — Card editor modal (Screen 2, minus dependencies)
- Centred modal. Fields: Title (required); Epic (select with inline "+ New epic" that
  dispatches ADD_EPIC and selects the new epic); Points (chip row 1 2 3 5 8 13 21 plus free
  positive-integer entry, G5); Summary (textarea, optional).
- Opening: clicking a story row opens it populated; "+ Story" on a group opens it blank with
  that group's epicId pre-filled.
- Footer: "Delete story" (left, danger-ghost, inline confirm); Cancel / Save (right).
- Escape = Cancel. Unsaved-changes guard on escape / overlay click when fields are dirty.
- The Dependencies section from Screen 2 is DEFERRED to the dependencies brief. Rationale:
  its picker groups candidate stories by sprint location (Sprint 1 ... Backlog), which needs
  story placement, which needs drag-and-drop. Building it now means building it twice. Flag
  if you want a different sequencing.

UI — Epic editor modal (Screen 2 variant)
- Same modal minus points and dependencies, plus the colour-dot picker (changeable colourKey).
- Deleting an epic with children prompts: delete the stories too, or move them to "No epic"
  (maps to DELETE_EPIC 'delete' / 'reparent'). No orphaned state.
- "+ Epic" in the panel header opens this editor blank (title required).

OUT OF SCOPE (parking lot; do not "while we're here" these — RoE anti-pattern)
- Drag-and-drop / placing stories in sprints (P0 #3, next brief).
- Dependencies, badges, tethers, the picker (P0 #5).
- Capacity honesty banner (P0 #4) — moot until stories can be placed.
- Exports (P0 #6); Resume / New-plan prompt (Screen 3); JSON import/export (P0 #7).
- Stretch toggle, labels, parked lane, stats strip (all P1).
- Within-backlog reorder and within-sprint stack order (facilitation theatre, arrives with DnD).

ASSERTED CASES (assert these exact outcomes; derive the rest; tests assert real values)
Seed fixtures directly into store state where needed (Brief 1 already seeds placedStoryIds).
1. Colour rotation: create epics in sequence; colourKeys cycle the palette in order; with an
   8-hue palette the 9th epic wraps to palette[0]. Plum is palette[0].
2. ADD_STORY (epicId = E1): stories map +1; the new id is at the END of backlog[];
   backlogGroups puts it under E1; epicSummary(E1).storyCount +1 and unplacedPoints += points.
3. ADD_STORY (epicId = null): lands in the "No epic" group; that group now renders.
4. EDIT_STORY moving epicId E1 -> E2: regroups under E2; its index in backlog[] is unchanged;
   no other story moves.
5. DELETE_STORY: that id is gone from stories AND from its holding array; total story count
   -1; every other story untouched (assert a sibling's presence and position).
6. DELETE_EPIC 'reparent' on an epic with 3 children: epics -1; story count identical; all 3
   children now epicId = null and appear under "No epic".
7. DELETE_EPIC 'delete' on an epic with 3 children: epics -1; exactly those 3 stories removed
   from the map and from all arrays; unrelated stories untouched.
8. Points validation: 0, -2, 2.5, "" are rejected; 1, 3, 8, 34 accepted.
9. Regeneration still conserves with the new schema: seed epics + stories, some seeded into
   sprint placedStoryIds; run a duration-shrink settings change; assert zero stories deleted,
   displaced stories returned to the top of the backlog, epics intact. Guards the Brief 1
   invariant against Brief 2's schema.

BRANDING
instrument-core tokens, data-app="plan". Plum accent for primary buttons, selected chips,
focus rings, and epic-adjacent UI; capacity amber/red stay reserved and unused here. Epic
colour dots from the palette (G4). Every number in IBM Plex Mono (points chips, the
"N stories · M pts" line). Bricolage for modal headings, Hanken for UI. Do not fork tokens.

DEFINITION OF DONE
- Schema, selectors, and reducer actions have passing unit tests asserting the cases above
  (real values, not "runs"). Delete atomicity and story conservation are explicitly asserted.
- Backlog panel renders epics and stories grouped by epic, with the No-epic bucket; create,
  edit, delete all work in the browser, verified against P0 #2 acceptance + Screen 1 backlog
  + Screen 2 editors.
- No data-loss path: no delete orphans or loses an unrelated story; no settings change deletes
  a card (re-verify against Brief 1's regeneration).
- Every state change is a discrete action; no view-layer mutation; modal UI state stays out of
  the store.
- I can explain every line. Build-log entry written (AI drafts, I sign off).

Start by PROPOSING: the epic and story object schema + id strategy, the action list with
payload shapes, the selector signatures, the modal local-state approach (dirty-tracking and
the unsaved guard), and any file-layout additions (e.g. a backlog-selectors module, a
card-editor module). No feature code yet.
