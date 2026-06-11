# sprintplan.uk - MVP User Journeys (v1.0)

**Status**: Drafted with AI, pending owner sign-off
**Owner**: [You]
**Companion to**: sprintplan-mvp-spec.md (v0.4)
**Date**: 11 June 2026

**Visual artefacts (Lucid)**:

- Journey map (E2E facilitator session + layout options record): https://lucid.app/lucidchart/9a797cbb-478e-4049-ad96-abccb3b2eb5f/edit
- Board layout sketch (vertical time, signed-off direction): https://lucid.app/lucidchart/c1940bd1-63e7-41a4-8b03-36a52ec19012/edit

**Persona**: Scrum Master / Delivery Manager facilitating monthly or quarterly planning for one team, screen-sharing in Teams. One persona, one driver; the team participates by voice, not by mouse.

**Session goal the journeys serve**: blank board to exported plan in under 15 minutes.

---

## Journey 1 - First visit and plan setup (target ~2 min)

1. Facilitator opens sprintplan.uk (suite-branded header, consistent with sprintpoker/sprintretro)
2. No saved board found
3. Plan setup: duration (1-3 months), sprint length (1-4 weeks, default 2), team velocity, buffer %
4. Board generates: sprint containers stacked vertically (time runs top to bottom), each header showing dates and adjusted capacity = velocity x (1 - buffer%)
5. Month rail renders on the left, computed from sprint dates (majority-of-days rule); a partial final sprint is visibly flagged
6. Backlog side panel sits empty, inviting the first epic

**Open question for screen visuals** (recommendation, pending sign-off): render the board instantly with sensible defaults (3 months, 2-week sprints, velocity 20, buffer 10%) and edit the values inline, rather than a blocking setup wizard. The 15-minute target argues against a wizard.

## Journey 2 - Build the backlog (~5 min)

1. Create an epic (title)
2. Add child stories: title, summary, points
3. Stories group visually under their epic in the backlog panel
4. Edit and delete work at any point; deleting an epic prompts about its children (no orphaned state)

## Journey 3 - Plan the sprints (the live session core, ~6 min)

1. Drag a story from the backlog into a sprint container; sprint total updates instantly
2. Drag between sprints, or back to the backlog; totals always follow
3. Capacity logic per sprint: total <= capacity neutral, within 10% over amber, more than 10% over red, status always visible in the sprint header
4. Over-capacity triggers the non-blocking honesty nudge ("Relabelling it a stretch goal does not add capacity"); facilitator rebalances or accepts with the risk on record
5. Facilitator may reorder stories inside a sprint to signal "do this first" to the room; stack order is facilitation theatre only and never changes totals, warnings, or the export

## Journey 4 - Mark dependencies

1. From either story in a pair: mark "this blocks..." or "this needs..." (one link type stored as a pair, Jira-style blocks / is blocked by)
2. The dependency control opens a picker to choose the paired story; one prerequisite can block several stories (1-to-many, separate pairs)
3. Both cards gain a shared badge (D1, D2...)
4. Same sprint: blocked story shows a visual tether to its prerequisite; cards are never auto-moved
5. Cross sprint: badges stay visible; the connector line draws on hover/select only (keeps the vertical board free of arrow spaghetti)
6. Violation (blocked story in an earlier sprint than its prerequisite): both cards and connector turn red; the violation is queued for the export's warnings section

## Journey 5 - Export and share (~1 min)

1. One click: choose Markdown, printable HTML, or CSV (shared data template, three renderers)
2. Summary contains sprints, stories, points, capacity status, dependency warnings, and the dedicated over-commitment section (every over-capacity sprint, by how much)
3. Facilitator pastes/attaches into Teams, Confluence, or Jira

## Journey 6 - Resume and portability (continuous)

1. Every action auto-saves to local storage; browser refresh loses nothing (zero data loss is the quality bar)
2. Board exports/imports as a JSON file to move machines or archive a plan
3. On a later visit with a saved board present, the facilitator returns to their plan

**Open question for screen visuals** (recommendation, pending sign-off): show a lightweight "Resume last board / Start new plan" choice rather than silent resume, so last quarter's plan never opens unannounced on a shared screen.

---

## Decisions taken during journey mapping (11 Jun 2026)

- **Vertical time layout**: months > sprints > stories, top to bottom; chosen by owner against the AI's column recommendation, on the strength of the Jira backlog-view mental model
- **Month rail**: visual rail computed from dates, majority-of-days assignment, never a data container (1-4 week sprints make strict containment impossible)
- **PI-board imagery is visual grammar only**: sticky cards, dependency connectors, red violations. No objectives, confidence votes, team lanes, or milestone row in v1 (milestone row parked at P1 consideration)
- **Dependency model**: either-side creation, picker-based pairing, 1-to-many, shared badges, tether without auto-move, on-demand connectors, red violations (spec v0.4, P0 #5)
- **Stack order**: facilitation signal only; recorded dependencies are the only ordering truth

## Open questions carried to the screen visuals thread

1. First run: instant board with editable defaults (recommended) vs setup wizard
2. Saved board on open: Resume / New plan prompt (recommended) vs silent resume
3. Where the dependency control lives on the card UI (card edit view vs hover action)
