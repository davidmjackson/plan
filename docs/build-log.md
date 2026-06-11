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

### 2026-06-11 - Brief 1: settings strip, sprint generation, capacity maths (first code)

- **Task brief**: docs/brief1.md - first vertical slice. Settings strip drives sprint generation, rendering sprint containers with capacity pills and the month rail. No cards/DnD/exports/backlog. Pure maths + rail + regeneration built and unit-tested first; UI wired second; single store with discrete named actions.
- **AI contribution**:
  - **Propose step** (per RoE): inspected the sibling suite repos to ground the stack instead of inventing one - found vanilla JS + Express + `node --test` + zod/pino, dragula already vendored, theme synced from `/var/www/suite/shared/theme`. Proposed store shape, action list, function signatures, file layout. Verified all five worked cases tie out *before* coding, surfacing one interpretation the brief never states: sprint days are counted **inclusively** (sprint 7 = 9 days, not 8, is the only reading that makes `round(18x9/14)=12` true). Flagged it rather than silently bake it.
  - **Stack review** (director asked): recommended keeping the suite stack; added two cheap insurances - `@ts-check` + JSDoc on the logic modules, and representing calendar dates as `YYYY-MM-DD` strings/integers (never JS `Date`) to dodge timezone/DST bugs in the danger zone. Both approved.
  - **Build (TDD, red-green-refactor throughout)**: `date.js` (10 tests), `plan-maths.js` (10), `month-rail.js` (4), `regenerate.js` (5), `store.js`+`actions.js` (11). 40 tests, all asserting real values from the brief. Then the view layer (`render.js`, `main.js`), `index.html`, `plan.css`, minimal `server.js`. Synced the Instrument theme via the blessed `sync-theme.mjs`; added `#glyph-plan` (inline) and the plum accent (`plan.css`) locally per the "don't touch the suite mid-brief" decision.
  - **Verification**: typecheck gate clean; 40/40 unit tests green; headless Chromium run reproduced every worked case live (defaults -> 7 sprints/cap 18, sprint 7 `0/12` partial; vel 30 -> sprint 7 `0/17`; 1-month -> 3 sprints, sprint 3 `0/5` partial) with zero console errors.
- **Human contribution**: Approved the proposed architecture; ruled on the stack question (keep vanilla suite stack, add `@ts-check` + string-dates); approved `server.js` for parity and keeping `--plum`/`#glyph-plan` local for now.
- **Friction**:
  - `tsc` reads `tsconfig.json`, not the `jsconfig.json` I first wrote (jsconfig is editor-only) - the gate silently printed help with exit 0 until corrected. Scoped the typecheck `include` to `public/js/**` so the gate needs zero extra `@types` deps (tests are covered by *running*, `server.js` is trivial node glue).
  - Playwright's package is CommonJS; the smoke script's named `import { chromium }` failed and needed the default-import form.
- **Verdict**: Test-first on the date/capacity maths was the right call exactly where the RoE says the risk lives - every worked case passed on first implementation because the interpretation work happened in the tests, not the code. The inclusive-day question would have been a latent off-by-one bug under tests-after. Grounding the stack in the real sibling repos beat proposing from memory.
- **Open housekeeping** (logged, not silently actioned): promote `#glyph-plan` and `--plum`/`--plumwash` to the shared `instrument-core.css`/`glyphs.svg`; register `plan` as a SURFACE in the theme `manifest.mjs` and add the drift-check test; resume/new-plan prompt (Screen 3) deferred to a later brief (this slice restores the saved board silently on load).
- **Time**: ~1 session.

### 2026-06-11 - v1 screen designs and the G1-G8 rulings

- **Task brief**: Design the v1 screens (board view, card editor with dependency picker, resume/new prompt, inline setup, export dialog) consistent with suite branding; grill where the docs underdetermine the design
- **AI contribution**: Pulled live Instrument theme tokens from the retrospective repo rather than designing from brand memory; produced inline mockups of the board view and card editor; surfaced eight design gaps (G1-G8), including one the board literally cannot render without (no plan start date anywhere in the spec) and a capacity-honesty gap on partial final sprints; drafted docs/v1-screen-designs.md, the spec v0.5 errata, and this entry
- **Human contribution**: Ruled all eight in one pass, accepting the recommendations: start date defaulting to next Monday; prorated partial-sprint capacity; index-identity regeneration with displaced stories returned to backlog, never deleted; new plum accent for data-app="plan" keeping amber/red reserved for capacity semantics; Fibonacci chips plus free entry, confirmed consistent with sprintpoker's deck; optional plan title; dependency picker open to backlog stories with violations evaluated only when both sides are scheduled; board save/load kept separate from report export
- **Friction**: The missing start date survived two review passes (spec v0.3 to v0.4 and journey sign-off) because both described the month rail as "computed from sprint dates" without ever defining the anchor. Screen design forced the question; reviews of prose did not. Also: the theme-manifest.txt in the retrospective repo is stale (lists Fraunces/Inter, actual theme is Bricolage/Hanken), worth a suite housekeeping ticket
- **Verdict**: Designing against the real theme file beat designing from memory; the grill format (gap plus recommendation each) closed eight rulings in a single reply. Two forced P0 additions (start date, title) were caught and logged under the scope rule instead of sliding in silently
- **Time**: ~1 session

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
