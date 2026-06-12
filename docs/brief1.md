BRIEF 1 — Settings strip, sprint generation, capacity maths

Read first: docs/sprintplan-mvp-spec.md (v0.5), docs/v1-screen-designs.md (v1.0),
docs/aide-rules-of-engagement.md. This brief follows the RoE cadence: PROPOSE before
you build. No feature code until I approve the approach.

GOAL
The first vertical slice: a settings strip that drives sprint generation, rendering
the board's sprint containers with capacity pills and the month rail. No cards, no
drag-and-drop, no exports, no backlog yet. Pills show 0 / capacity for now.

TWO RULINGS BAKED INTO THIS BRIEF (flag if you disagree, do not silently change):
- Days are CALENDAR days, not working days, everywhere in the maths.
- Plan length: plan end = start date + N calendar months (clamp day-of-month
  overflow). Sprints are laid back-to-back from the start date, each
  (sprint_weeks x 7) calendar days. The final sprint is truncated at plan end and
  marked partial. If plan days divides evenly by sprint days, there is no partial.

ARCHITECTURE CONSTRAINT (non-negotiable, RoE quality gate)
- Single store. Every state change is a discrete, named action/mutation. No direct
  state mutation from view code. This is the multiplayer-insurance pattern; a sync
  layer must be additive later, not a rewrite. Propose the store shape and the
  action list before writing it.
- Sprint generation and capacity maths are PURE functions over plan settings,
  unit-testable without the DOM. Build and test them first, wire the UI second.

CAPACITY MATHS (the danger zone — your own RoE flags date/sprint arithmetic)
- Adjusted capacity = round(velocity x (1 - buffer/100)), minimum 1.
- Partial final sprint capacity = round(adjusted capacity x partialDays / fullSprintDays),
  minimum 1.
- Pill state vs placed total: total <= capacity neutral; over by <= 10% amber;
  over by > 10% red. Thresholds computed against adjusted (or prorated) capacity.

WORKED TEST CASES (assert these exact numbers; derive the rest)
Fixture start date: Mon 6 Jul 2026.
1. Adjusted capacity: (20, 10%) -> 18. (15, 20%) -> 12. (21, 15%) -> 18. (5, 0%) -> 5.
2. Defaults (start 6 Jul 2026, 3 months, 2-week sprints): 7 sprints. Sprints 1-6
   full (capacity 18). Sprint 7 = 28 Sep to 6 Oct, 9 days, partial,
   capacity = round(18 x 9/14) = 12.
3. (start 6 Jul 2026, 1 month, 2-week sprints): 3 sprints. Sprint 3 = 3-6 Aug,
   4 days, partial, capacity = round(18 x 4/14) = 5.
4. Proration minimum: a 1-day partial at low capacity must floor to 1, never 0
   (e.g. capacity 5, 1 day -> round(0.36) = 0 -> clamp to 1).
5. Pill state: capacity 18, placed 18 -> neutral. Placed 19 -> amber (5.6% over).
   Placed 20 -> red (11.1% over).

MONTH RAIL
- Computed visual rail, never a drop target, holds no data. One segment per month
  the plan spans. A sprint is assigned to the month holding the majority of its
  calendar days; on a 7/7 tie the earlier month wins. Pure function, unit-tested.

G3 REGENERATION (write the logic now, test with seeded fixture state)
Even though cards arrive in a later brief, implement regeneration as a pure function
over store state so it is testable today with fixture stories:
- Sprints keep identity by index.
- Duration/length change reducing sprint count: stories in removed indexes return to
  the top of the backlog. Assert no story is deleted and the returned-count is correct.
- Sprint length change: containers re-date, placements persist by index.
- Start date change: re-date only, placements untouched.
- Velocity/buffer change: recompute pills only.

BRANDING
Use instrument-core.css tokens. This app is data-app="plan". Add the plum accent
(--plum / --plumwash, approx oklch(0.50 0.10 290)) and a #glyph-plan symbol now so
branding is real from the first commit. Every number renders in IBM Plex Mono.

DEFINITION OF DONE
- Pure maths + rail + regeneration functions have passing unit tests asserting the
  cases above (tests assert real values, not just "runs").
- Settings strip edits regenerate the board live; capacity is read-only and derived.
- I can explain every line. Build-log entry written.

Start by PROPOSING: store shape, action list, function signatures, and your file
layout. No feature code yet.