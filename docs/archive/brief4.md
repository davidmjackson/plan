BRIEF 4 — Capacity honesty banner (P0 #4)

Read first: docs/sprintplan-mvp-spec.md (v0.5: P0 #4 and resolved decision 2 on
prorated partials), docs/v1-screen-designs.md (v1.0: Screen 1 "Honesty nudge" plus the
cross-cutting legibility rule), docs/aide-rules-of-engagement.md, and
docs/build-state-after-brief3.md (what the code actually is now, not just what the specs
say). RoE cadence applies: PROPOSE before you build. No feature code until I approve the
approach. Feature branch per brief (e.g. brief-4-honesty-banner).

GOAL
The honest surfacing of over-commitment. Brief 3 lit the capacity pills off neutral for
the first time, so a sprint can now be genuinely over capacity. P0 #4 is the slim,
non-blocking banner that renders inside an over-capacity sprint container, names the
overshoot in points, and refuses the "stretch goal" rationalisation. It is dismissible
per sprint per session and reappears next session if the sprint is still over. This is a
small, derived-view slice: the thresholds, the pill colours, and the placed-points and
capacity maths all already exist and are tested. This brief adds no store action. It adds
one tiny pure helper, one view module that owns the dismiss state, the banner render, one
delegated click branch, and CSS.

Banner only in this brief. Not dependencies (P0 #5), not exports (P0 #6), not JSON
import/export or the resume prompt (P0 #7).

WHAT THIS SLICE EXTENDS (from build-state-after-brief3.md)
The seams are already cut. renderBoard (render.js) already computes, per sprint, the three
figures the banner needs: placed = sprintPlacedPoints(state, sprint.index), capacity =
sprintCapacity(sprint, settings), and state2 = pillState(placed, capacity). The banner is
derived from exactly those, nothing new. pillState (plan-maths.js) is the single threshold
authority: at or under capacity = neutral, up to and including 10% over = amber, more than
10% over = red. The dismiss-per-session pattern already exists in the codebase: backlog.js
holds a module-local `const collapsed = new Set()`, exports toggleCollapsed, and main.js
re-paints after a toggle (collapse is view state, never the store). The banner's dismiss is
the same shape with a different Set. main.js already runs a single delegated click listener
on #board (today it opens the card editor for placed cards) guarded by isDragging(), so the
dismiss click has a home. This brief invents no new architecture.

THE INVARIANT THAT DRIVES THIS BRIEF (read before the rulings)
The banner and the pill must never disagree. If the banner gets its own "is this over"
threshold, it can drift from the pill: a pill could read amber while no banner shows, or a
banner could show on a neutral pill. That is the exact dishonesty this tool exists to
prevent, turned inward on its own UI. So the banner's visibility is DERIVED FROM pillState,
not from a parallel rule, and the overshoot figure is a single pure tested expression
(placed minus capacity). The asserted cases below pin the boundary (placed == capacity then
placed == capacity + 1) so the banner provably appears exactly as the pill leaves neutral,
and a separate-threshold regression fails the test.

RULINGS BAKED INTO THIS BRIEF (flag if you disagree, do not silently change)
- BANNER VISIBILITY IS DERIVED FROM THE PILL, NEVER A SECOND THRESHOLD. The banner shows
  exactly when pillState(placed, capacity) is not "neutral", i.e. when placed > capacity,
  for amber AND red alike. The overshoot is placed minus capacity, computed by one pure
  tested helper. No separate over/under logic anywhere. (See the invariant above.)
- NO NEW STORE ACTION. The banner is derived view data over existing state; the dismiss is
  view-local. The reducer, the action vocabulary, and the state shape are untouched, the
  same way the pill colour and the backlog collapse added none.
- DISMISS IS PER SPRINT PER SESSION, VIEW-LOCAL, MIRRORING backlog.js's collapsed SET. A
  module-local Set of dismissed sprint indexes lives in a view module, exactly like
  `collapsed`. It is never in the store and never autosaved: a dismissal is not plan data,
  and a refresh is a new session that must re-arm every still-over banner (spec: "reappears
  next session if still over"). Dismiss = add the index, re-paint. Reload = empty Set.
- THE PILL CARRIES THE ALWAYS-ON SIGNAL; THE BANNER IS THE ONE-TIME NUDGE. Dismissing the
  banner never touches the pill: the pill stays amber/red with its number. Because the pill
  is the permanent honesty signal, a dismissed banner does NOT re-appear when the
  facilitator drags MORE points into the same sprint mid-session (the pill already shouts
  the new total). The banner is the rationalisation nudge, closeable once per session; the
  pill is the truth that cannot be closed. (This is what makes "dismiss per session" safe.)
- BANNER USES THE CAPACITY WASH, MATCHED TO PILL STATE, NEVER PLUM. An amber-over sprint
  gets the amber wash, a red-over sprint gets the red wash, so banner severity tracks the
  pill. plan.css already carries --amberwash, --red, and --redwash (used by .cap-pill.is-amber
  / .is-red); reuse them, fork no token. Plum is the app accent and never means capacity
  (G4). [Flag: single neutral-warning style for both vs amber/red-matched. I recommend
  matched: it reinforces severity at zero cost and stays consistent with the pill.]
- COPY IS THE SCREEN-DESIGN STRING. "Over committed by N pts. Relabelling it a stretch goal
  does not add capacity." N is the live overshoot, rendered in mono (the suite "this is
  data" rule). [Flag the exact wording for sign-off: the spec's example reads "This sprint
  is over committed...", the screen design reads "Over committed by N pts..."; I am taking
  the screen design because it carries the number, which also satisfies the legibility rule
  that pill/over states are distinguishable by label text, not colour alone. Hyphen
  ("over-committed") is your call.]
- PARTIAL FINAL SPRINTS GET THE BANNER TOO, with no special case. They read the same placed
  and (prorated) capacity the pill reads; a partial sprint at prorated capacity 9 holding 12
  points is over by 3 and banners like any other. No full-capacity leak, no separate path.

THE SUBTLE CALL (flag hardest here): REGENERATION AND STALE DISMISSALS
Dismissal is keyed by sprint INDEX, and sprints keep identity by index (G3). A settings
change regenerates containers: it can change a sprint's capacity (velocity/buffer), re-date
it (start/length), or remove and later re-add an index (duration). That opens a stale-index
hole: dismiss sprint 5 while over, shrink duration so index 5 is gone, grow it back, and a
genuinely over sprint 5 would render with its banner suppressed by a dismissal from a
different plan shape. A suppressed banner on a real over-commit is precisely the failure
this app is against.

My ruling (weakest of this brief, most likely to be overturned): a settings change
(regeneration) CLEARS the dismissed set. Capacity just changed, so re-arming every banner is
the honest default and it closes the stale-index hole outright. MOVE_STORY does NOT clear it
(the per-session promise above). Mechanism is a PROPOSE item: store subscribers currently
receive state only, not the action that produced it, so you must propose how a settings
change signals "clear" without leaking view state into the store, e.g. clear the Set inside
the five settings-strip dispatch handlers in main.js (the only paths that regenerate), or a
narrowly justified equivalent. Do not widen the store contract for this.
If you would rather match backlog-collapse exactly (never auto-clear, accept the obscure
re-grown-index edge), say so and I will drop the clear.

ARCHITECTURE CONSTRAINT (non-negotiable, RoE quality gate)
- The overshoot figure is a PURE selector/helper, DOM-free and unit-tested, the same
  pattern Brief 1 used for capacity, Brief 2 for the backlog groups, and Brief 3 for placed
  points. Build and test it before any DOM is wired.
- Banner visibility is derived from the already-tested pillState, not a new threshold. The
  view reads placed/capacity (already computed in renderBoard) and the helper; it computes
  no capacity maths of its own.
- The dismissed Set lives in a view module, never the store, never localStorage. The view
  never mutates store state. paint() re-renders on dismiss, exactly as it does on collapse.

NO NEW ACTION (explicit)
No LINK_DEP (dependencies, later brief). No banner action. The reducer and the 15-action
vocabulary are unchanged. The only new code is: one pure helper (+ its tests), one view
module holding the dismissed Set and the banner builder, render.js wiring, one delegated
click branch in main.js, and CSS.

DERIVED VIEW DATA (pure, unit-tested, DOM-free)
- overBy(placed, capacity): returns Math.max(0, placed - capacity). This is the overshoot N
  and, because overBy > 0 is provably identical to pillState(placed, capacity) !== "neutral",
  it is also the visibility predicate. PROPOSE whether to ship it bare or paired with a small
  combined helper (e.g. one returning { over: boolean, by: number }); keep it minimal, this
  is not a place for an abstraction layer. It belongs alongside the other capacity maths
  (plan-maths.js) or in board-selectors.js; propose which and justify in one line.

VIEW WIRING (banner module + dismiss)
- New view module (e.g. banner.js), mirroring backlog.js: a module-local
  `const dismissed = new Set()` of sprint indexes; `dismissBanner(index)`,
  `isBannerDismissed(index)`, and `clearDismissedBanners()` exports; and a `bannerEl(...)`
  builder that returns the slim banner node carrying the dismiss control with
  data-act="dismiss-banner" and data-sprint-index.
- renderBoard imports the builder and isBannerDismissed. After it appends the sprint head
  and before the body, when overBy(placed, capacity) > 0 and the index is not dismissed, it
  appends the banner (the .sprint container is already a flex column with gap, so the banner
  slots between head and body with no layout surgery). Neutral, under, and empty sprints
  render no banner (an empty sprint has 0 placed and cannot be over).
- main.js extends the existing #board delegated click listener to handle
  data-act="dismiss-banner": read the sprint index, call dismissBanner(index), then
  paint(store.getState()) (same shape as the backlog toggle-epic branch). It is already
  guarded by the isDragging() swallow at the top of that listener. Confirm the dismiss
  button cannot also trip edit-story: the banner is a sibling of the body, not inside a
  placed card, so a closest("[data-act='edit-story']") match should miss it. Verify in the
  browser, do not assume.

UI — the banner (Screen 1, sprint container "Honesty nudge")
- Slim horizontal banner inside the sprint container, between the header and the body.
- Text: "Over committed by N pts. Relabelling it a stretch goal does not add capacity.", N
  in mono (12px minimum per the legibility rule).
- A small dismiss control on the right (an x icon button) with an accessible label, e.g.
  aria-label="Dismiss over-commitment notice for this sprint".
- Amber wash for an amber-over sprint, red wash for a red-over sprint, matched to the pill
  (ruling above). Body text at least 13px. Non-blocking: it never disables a drop, an edit,
  or a settings change, it only flags and records.

HOUSEKEEPING — dragula duplication ticket (RAISE only, do NOT execute the cross-repo move)
plan/public/vendor/dragula/ and retrospective/public/vendor/dragula/ each carry an identical
dragula.min.js and dragula.min.css; index.html loads them from /vendor/dragula/. Brief 4
RECORDS the decision, it does not move files across repos. Produce a short, decision-ready
housekeeping note (a docs/ entry plus a build-log housekeeping line) capturing:
- the duplication (two copies, same two files, one per app);
- the options: a single shared suite vendor location both apps reference, vs each app keeping
  its own copy;
- the trade-offs: one source of truth and a single version pin and one place to patch, set
  against the serving/load-path change and the cross-app coupling a shared copy introduces;
- a recommendation;
- what actioning it would touch: both apps' index.html load paths and the suite's shared
  serving setup. Note explicitly that the shared suite location lives outside this repo, so
  the actual move is a separate suite-level change against a second live app and is therefore
  out of scope for a single feature brief (RoE: no architecture by accident, no silent
  cross-repo refactor).
Carry-forward, still NOT actioned this brief (record as remaining open, do not touch):
promote --plum / --plumwash, #glyph-plan, and the 8 epic-palette tokens to the shared
instrument-core source; register `plan` as a SURFACE in the theme manifest.mjs and add the
check-theme-drift test.

OUT OF SCOPE (parking lot, do not "while we're here" these, RoE anti-pattern)
- Dependencies: badges, tethers, cross-sprint connectors, the picker, violation borders, and
  the card editor's Dependencies section (P0 #5). Unblocked by Brief 3's placement, but not
  this brief.
- Exports (P0 #6) and the over-commitment section they will contain. The banner is the
  in-board surfacing; the report's over-commitment list is a separate brief that will reuse
  the same overBy figure.
- JSON import/export and the Resume / New-plan prompt (P0 #7, still silent restore).
- Stretch toggle, labels, parked lane, stats strip (P1). The stretch toggle is the natural
  companion to this banner but stays parked.
- Sub-1280px backlog drawer; dark mode.
- No change to the pill thresholds: they are correct and tested. The banner CONSUMES
  pillState, it never redefines it.

ASSERTED CASES (assert these exact outcomes, derive the rest, tests assert real values)
Seed fixtures directly into store state. Defaults give capacity 18.
1. KEYSTONE — BANNER TRACKS THE PILL, NEVER ITS OWN THRESHOLD. placed = 18, capacity = 18:
   pillState neutral, overBy = 0, no banner. placed = 19: pillState amber, overBy = 1,
   banner shows "by 1". placed = 24: pillState red, overBy = 6, banner shows "by 6". The
   18 -> 19 boundary proves the banner appears exactly as the pill leaves neutral; a
   separate or red-only threshold fails at 19.
2. AMBER SHOWS THE BANNER (guards the "only red is over" misreading): placed = 19,
   capacity = 18, pillState amber AND banner present, overBy = 1.
3. EXACT CAPACITY IS CLEAN: placed = 18, capacity = 18, neutral, overBy = 0, no banner.
4. UNDER CAPACITY IS CLEAN: placed = 10, capacity = 18, neutral, overBy = 0, no banner.
5. PRORATED PARTIAL OVER: a partial sprint with prorated capacity 9 holding 12 points:
   overBy = 3, pillState(12, 9) = red (33% over), banner "by 3". Proves the banner reads the
   same prorated capacity the pill does, with no full-capacity leak.
6. overBy IS NEVER NEGATIVE: placed = 5, capacity = 18, overBy = 0 (not -13). Defensive
   purity, so the figure can be rendered unguarded.
Dismiss is view-local and verified in the browser (DoD below), not a pure case, the same way
Brief 3 kept the drag gesture out of the unit net.

BRANDING
instrument-core tokens, data-app="plan". The banner reuses the pill's capacity washes
(--amberwash / --redwash and their text colours, already in plan.css) matched to pillState;
N in IBM Plex Mono; no plum; no new token. Minimum 13px body, mono numbers 12px+.

DEFINITION OF DONE
- overBy (and any paired helper) has passing unit tests asserting the cases above with real
  values, including the boundary that proves banner visibility equals the pill leaving
  neutral.
- No new store action; reducer and state shape untouched; the dismissed Set is view-local
  (a module Set, like collapsed) and is never persisted.
- renderBoard shows the banner inside over-capacity containers (amber AND red) with the exact
  copy and the mono N; neutral, under-capacity, and empty sprints show none.
- Dismiss hides that sprint's banner for the session and leaves the pill unchanged; reload
  re-arms a still-over banner; [a settings change re-arms per the flagged ruling]; a dismiss
  click never opens the card editor; a drag never triggers a dismiss.
- Dragula duplication ticket written (decision-ready note plus a build-log housekeeping
  line); no files moved across repos; the theme-token promotion item recorded as still open.
- Verified in the browser against P0 #4 acceptance and the Screen 1 honesty-nudge spec, zero
  console errors.
- I can explain every line. Build-log entry drafted (AI drafts, I sign off).

Start by PROPOSING: the overBy helper signature and home (and whether to pair it with a
combined banner-state helper); the banner module shape (dismissed Set, builder, clear),
mirroring backlog.js; the regeneration-clears-dismissed mechanism given subscribers see only
state; the dismiss click wiring on #board and the proof it cannot trip edit-story; and the
exact banner copy and hyphen. No feature code yet.
