# sprintplan.uk - MVP Specification (v0.5)

**Status**: Decisions locked, user journeys mapped, v1 screens designed (docs/v1-screen-designs.md), ready for build briefs
**Owner**: [You]
**Type**: Free showcase app / AI-Directed Engineering training project
**Date**: June 2026

---

## Problem Statement

Scrum Masters and Delivery Managers are repeatedly asked "what can we deliver in the next 1-3 months?" and have no fast, visual way to answer it. Jira holds the backlog but hides the capacity picture; spreadsheets hold the capacity but hide the work. The cost is slow planning sessions, over-committed sprints, and forecasts nobody trusts.

**One-line pitch**: A lightweight whiteboard that shows what your team can realistically deliver in the next 1-3 months, sprint by sprint, against your backlog.

## Goals

1. A facilitator can build a visual 1-3 month delivery plan from a blank board in under 15 minutes.
2. Over-capacity sprints are impossible to miss (instant visual warning when sprint points exceed adjusted velocity).
3. A shareable plan summary can be produced at the end of a session in one click.
4. The codebase demonstrates AI-Directed Engineering practice end to end (documented in the build log).

## Non-Goals (v1)

- **Multi-user real-time editing.** Facilitator drives, shares screen in Teams. Architecture must allow multiplayer later (single state store, action/event model).
- **Jira integration (import or sync).** Phase 2 and first paid-tier candidate. Manual card entry only in v1.
- **Accounts, login, or server-side persistence.** Local storage plus export/import of plan files. Keeps compliance load at zero.
- **SAFe ceremony features** (PI Objectives, confidence votes, ROAM). This is a delivery planning board, not a PI Planning suite.
- **Chat, rooms, presence, video.** Teams/Slack/Zoom own communication.

## Target User

Scrum Master / Delivery Manager / team lead facilitating quarterly or monthly planning for one team, remote or co-located, screen-sharing in Teams.

## User Stories (priority order)

1. As a facilitator, I want to set my plan duration (1, 2, or 3 months) and sprint length (1-4 weeks, default 2) so the board generates the right sprint containers.
2. As a facilitator, I want to set team velocity and a buffer % so each sprint shows realistic adjusted capacity, not raw capacity.
3. As a facilitator, I want to create epics and child story cards with a title, summary, and points so the backlog is visible on the board.
4. As a facilitator, I want to drag story cards from the backlog into sprint containers so the team can see the plan take shape live.
5. As a facilitator, I want each sprint container to show running total vs capacity and turn amber/red when over-loaded so over-commitment is caught in the room.
6. As a facilitator, I want to mark a dependency between two stories so the board flags when a dependent story is scheduled before its prerequisite.
7. As a facilitator, I want to export a plan summary (epics, stories per sprint, totals, flags) so I can share the outcome in Teams or attach it to Confluence/Jira.
8. As a facilitator, I want my board saved locally and exportable as a file so I can close the browser and resume later or move machines.

## Requirements

### Must-Have (P0)

| # | Requirement | Acceptance criteria (abridged) |
|---|---|---|
| 1 | Plan setup: start date (default next Monday), duration (1-3 months), sprint length (1-4 wks, default 2), velocity, buffer %, optional plan title | Given setup is complete, the board renders the correct number of sprint containers dated from the start date, each showing adjusted capacity = velocity x (1 - buffer%); a partial final sprint shows prorated capacity. The title, when set, appears on the board header and all exports |
| 2 | Epic and story cards (title, summary, points) with epic > story grouping | Cards can be created, edited, deleted; stories visually grouped under their epic in the backlog panel |
| 3 | Drag and drop: backlog to sprint, sprint to sprint, sprint to backlog | Card moves update sprint totals instantly; no orphaned state after any move |
| 4 | Capacity logic per sprint | Total <= capacity: neutral. Within 10% over: amber. More than 10% over: red. Thresholds visible on the container. Over-capacity sprints show a non-blocking warning that discourages the "stretch goal" rationalisation (e.g. "This sprint is over committed. Relabelling it a stretch goal does not add capacity."). The tool never blocks the user; it flags and records |
| 5 | Story-to-story dependency link ("do this first" / "blocked by") | One link type stored as a pair, creatable from either side: mark a story as blocking another, or as needing another (Jira-style blocks / is blocked by). Ticking the dependency control opens a picker to choose the paired story. One prerequisite can block multiple stories (1-to-many, rendered as separate pairs). Each pair shares a visible badge on both cards (D1, D2...). Same sprint: blocked story shows a visual tether to its prerequisite; cards are never auto-moved. Cross sprint: badges always visible, connector line drawn on hover/select only. Violation (blocked story scheduled in an earlier sprint than its prerequisite): both cards and the connector turn red, and the violation is listed in the export's warnings section |
| 6 | Plan summary export: markdown, printable HTML, and CSV | One click produces a clean summary in the chosen format: sprints, stories, points, capacity status, dependency warnings. Includes a dedicated **over-commitment section** listing every sprint over capacity, by how much, so the risk is on the record and visible to stakeholders. CSV is flat (one row per story) for spreadsheet/Jira-friendly reuse |
| 7 | Local persistence + file export/import | Board state survives browser refresh; plan can be exported/imported as JSON |

### Nice-to-Have (P1, fast follow)

- Story-level "stretch" toggle: stories in an over-capacity sprint can be marked as stretch; they stay counted in totals and are listed separately in the report (honesty preserved, rationalisation visible)
- Contextual tooltips on key concepts (velocity, buffer %, capacity thresholds, dependencies)
- Unplanned/parked lane for stories that don't fit the window
- Colour tags or labels on cards
- Basic stats strip: total points planned vs total capacity across the plan
- Dark mode (cheap goodwill, suite consistency)

### Future Considerations (P2, architectural insurance)

- Best-practice guides / planning playbook content (short, opinionated, in-app)
- AI planning assistant (conversational helper offering expert steering during planning; explicitly parked as a brain-dump idea, revisit only after MVP ships and real usage exists)
- Multi-user real-time editing (design v1 state as a single store with action/event updates so a sync layer can bolt on)
- Jira CSV import, then two-way sync (paid tier candidate)
- Accounts and cloud-saved plans (paid tier candidate)
- Multiple teams/boards per plan

## Success Metrics

This is a showcase/training project, so metrics are weighted to learning and usage signal, not revenue.

- **Leading**: time from blank board to exported plan in a real session (target: under 15 min); 10+ real planning sessions run on it within 60 days of launch (yours plus anyone else's)
- **Lagging**: unsolicited external users (target: 25 boards created by people you didn't recruit in 90 days); AI-Directed Engineering build log completed and publishable
- **Quality bar**: zero data-loss bugs reported (lost board state is the one unforgivable failure for this app)

## Technical Notes (constraints, not design)

- Web app, consistent with the sprintpoker/sprintretro suite stack
- **Suite branding from day one**: shared header/nav/visual identity with sprintpoker.uk and sprintretro.uk
- All state client-side in v1 (local storage + JSON export); no backend required to ship
- State architecture: single store, mutations as discrete actions, so a real-time sync layer (Liveblocks/Yjs/SignalR) is additive, not a rewrite
- Drag-and-drop via a mature library, not hand-rolled

## Resolved Decisions (was Open Questions)

1. **Estimation unit**: story points only in v1. No days mode. Input via Fibonacci chips (1, 2, 3, 5, 8, 13, 21) plus free positive-integer entry, consistent with sprintpoker's deck.
2. **Sprint length**: 1-4 weeks, default 2 weeks. Plan duration 1-3 months. Maximum flexibility by design: companies run unusual sprint lengths for niche workstreams (e.g. release cycles in the DoD spawning UAT fixes inside the sprint window). The tool never blocks a timing combination. Sprint count = ceiling of plan weeks / sprint weeks; a partial final sprint is flagged visibly, not hidden. A partial final sprint's capacity is prorated: adjusted capacity x (partial days / full sprint days), rounded to the nearest whole point, minimum 1; full capacity on a part-sprint would be exactly the dishonesty this tool exists to prevent. The tool's opinion lives in capacity warnings and the report, not in restricting how teams set their clock.
3. **Export formats**: markdown summary, printable HTML, and CSV (all three in v1; shared data template, three renderers).
4. **Branding**: full suite branding at launch.
5. **Board layout: vertical time.** Months > sprints > stories, time runs top to bottom (matches the Jira backlog-view mental model the target user lives in). Sprint containers stack vertically with capacity status in the header; backlog is a side panel. Months render as a computed **visual rail**, not a data container: a sprint is assigned to the month holding the majority of its days, and straddling sprints are possible by design (1-4 week sprints make strict month containment impossible). The month rail is a deliberate, small addition to P0 accepted under the scope rule. PI-board imagery (Aha!, program boards) informs visual grammar only: sticky cards, dependency connectors, red for violations. No objectives row, confidence votes, milestone/event row, or team lanes in v1 (milestone row parked at P1 consideration).
6. **Stack order is a facilitation signal only.** Facilitators can freely reorder stories inside a sprint to signal "do this first" to the room. Order never affects totals, capacity maths, warnings, or the export. Recorded dependencies (decision in P0 #5) are the only ordering truth the tool acts on.
7. **Settings changes never destroy data.** Editing setup values regenerates sprint containers in place: sprints keep identity by index; stories in removed sprints return to the top of the backlog with a visible notice; sprint length changes re-date containers but placements persist by index; velocity/buffer changes only recompute capacity status. No settings change deletes a story or epic (the zero-data-loss bar's hardest test).

## Timeline and Phasing

- **Phase 1 (MVP, target 2-4 weeks of build)**: P0 list above, single-user
- **Phase 2**: P1 items + multiplayer spike + Jira CSV import
- **Phase 3 (only on traction)**: accounts, cloud saves, paid tier

**Scope rule**: any addition to P0 must displace something from P0 or extend the timeline explicitly. The parking lot for good ideas is the P1/P2 lists, not the sprint.

## Change Log

- **v0.5 (11 Jun 2026)**: Screen design errata (see docs/v1-screen-designs.md, rulings G1-G8). P0 #1 gains a plan start date (default next Monday) and an optional plan title, both forced additions discovered at screen design. Partial final sprint capacity is prorated (resolved decision 2). Points input fixed as Fibonacci chips plus free entry (resolved decision 1). New resolved decision 7: settings changes never destroy data.
- **v0.4 (11 Jun 2026)**: User journeys mapped (see docs/user-journeys.md and linked Lucid documents). P0 #5 dependency model expanded: either-side creation, 1-to-many, shared badges, same-sprint tether without auto-move, on-demand cross-sprint connectors, red violations in board and export. New resolved decisions 5 and 6: vertical-time board layout with majority-rule month rail; stack order as facilitation signal only.
- **v0.3**: Decisions locked: points-only estimation, 1-4 week sprints, three export formats, suite branding.
