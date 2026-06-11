# sprintplan.uk - Build Log

The Capstone artefact. Every working session ends with an entry, per the rules of engagement.
Entries are newest first. Be honest: friction and failure are the valuable material.

---

## Entry Template (copy for each session)

### YYYY-MM-DD - [Brief title]

- **Task brief**: what was directed
- **AI contribution**: what the AI proposed and produced (summarise, link commits)
- **Human contribution**: decisions made, corrections issued, code rejected and why
- **Friction**: where the AI went wrong, hallucinated, over-engineered, or needed steering
- **Verdict**: what worked, what you would direct differently next time
- **Time**: rough effort spent

---

## Entries

### 2026-06-11 - User journeys and board layout direction

- **Task brief**: Map the MVP user journeys visually (Lucid) and pressure-test the board layout against PI Program Board inspiration images
- **AI contribution**: Built two Lucid documents (E2E facilitator journey map with a layout A/B; vertical-time board sketch); challenged the SAFe-flavoured imagery against the spec's non-goals; surfaced three design holes in the proposed dependency model (month containment maths, checkbox needs a paired target, auto-grouping vs manual stack order); drafted user-journeys.md, spec v0.4 amendments, and this entry
- **Human contribution**: Chose vertical-time layout (months > sprints > stories) against the AI's column recommendation, on the Jira backlog-view familiarity argument; confirmed inspiration images as visual grammar only; accepted majority-rule month rail, either-side dependency creation, 1-to-many pairs, and tether-without-auto-move
- **Friction**: AI initially recommended horizontal time from the inspiration images and reversed when the Jira mental-model argument landed; first Lucid tool call failed on a missed approval prompt before connecting cleanly; Lucid imports leave "Text" placeholders on empty container shapes (cosmetic). Connector repair session: Lucid's edit API silently no-ops endpoint repositioning on imported lines (returned success, changed nothing) so delete-and-recreate is the reliable path; PNG export serves stale cached renders, so document data (fetch) is the verification source of truth; auto-link sometimes picks geometrically short but visually bad anchors, and explicit endpoint pinning beats it for long cross-row lines. Figma was connected and tested as an alternative but the account seat is view-only (paywalled for editing), so Lucid stays the diagram tool
- **Verdict**: Rendering the layout argument as a visual A/B in Lucid settled it faster than prose; the grilling converted a one-line dependency idea into a buildable interaction model before any code
- **Time**: ~1 session

### 2026-06-11 - Project inception (pre-code)

- **Task brief**: Evaluate the original PI Planning concept, reframe, spec the MVP, define AIDE rules of engagement
- **AI contribution**: Opportunity assessment with competitor research and scoring (18/30 as PI Planning tool, 20/30 reframed); drafted MVP spec through v0.3; drafted rules of engagement v0.1; scaffolded this /docs bundle
- **Human contribution**: Reframed the concept away from SAFe PI Planning to a capacity visualisation board; cut rooms/DM/lobby scope; decided free-to-use, single-user MVP, points-only estimation, 1-4 week sprint flexibility, three export formats, suite branding; named it sprintplan.uk and registered the domain; created the repo; flagged own scope creep (AI helper character) and parked it at P2
- **Friction**: Original concept drifted from SAFe norms (6 sprints in 3 months, parent/child dependency model); first spec draft assumed 1-2 week sprints, corrected to 1-4 weeks after the niche-workstream rationale
- **Verdict**: Reframing before building saved the project from the communication-platform trap. Spec locked before any code written
- **Time**: ~3 sessions of analysis and drafting
