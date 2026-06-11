# sprintplan.uk - AI-Directed Engineering: Rules of Engagement (v0.1)

**Status**: Draft for review
**Owner**: [You] (Director of Engineering for this project)
**Companion to**: sprintplan-mvp-spec.md (v0.3)
**Purpose**: Define how AI and human responsibilities split on this build, and how the process is captured. The build log produced under these rules IS the Capstone artefact. The app is the demo; the log is the evidence.

---

## Operating Model in One Line

You are the director: you own intent, architecture, acceptance, and judgement. The AI is the engineering capacity: it proposes, scaffolds, implements, and tests under your direction. Nothing ships that you have not read and understood.

## Role Split

### You own (non-delegable)

- **Intent**: what gets built, in what order, and why (the spec is the contract)
- **Architecture decisions**: state model, data shapes, library choices, the multiplayer-ready action/event pattern
- **Acceptance**: every feature is verified against its acceptance criteria by you, in the browser, before it is "done"
- **Code review**: you read every line that lands. If you cannot explain a block of code, it does not merge
- **Scope defence**: P0 is the build list. Any addition displaces something or extends the timeline (spec scope rule applies to you too)
- **The build log**: written by you (AI can draft entries, you edit and sign off)

### The AI owns (delegated, supervised)

- **Proposals**: implementation options with trade-offs before significant code is written
- **Scaffolding**: project setup, boilerplate, config, file structure
- **Implementation**: feature code against your direction and the spec's acceptance criteria
- **Tests**: unit tests for capacity logic, sprint generation, dependency warnings, export rendering (the logic-heavy areas)
- **Refactoring suggestions**: flagged, never silently applied
- **Documentation drafts**: README, code comments, build log entries for your edit

### Shared

- **Debugging**: AI diagnoses and proposes, you approve the fix and confirm root cause is understood, not patched over
- **Design decisions within architecture**: AI proposes component structure, you approve before build

## Workflow Cadence

Work in **directed increments**, not open-ended sessions:

1. **Brief**: you write a short task brief (what, acceptance criteria reference, constraints). One feature or slice per brief
2. **Propose**: AI responds with approach + trade-offs. You pick or redirect. No code yet for anything non-trivial
3. **Build**: AI implements. Small diffs preferred over big-bang drops
4. **Review**: you read the code, run it, test against acceptance criteria
5. **Log**: build log entry written (see below). Then next brief

**Session rule**: every working session ends with a log entry, even if the session failed. Failed sessions are often the best Capstone material.

## Quality Gates (definition of done per feature)

- [ ] Acceptance criteria from the spec pass, verified by you in the browser
- [ ] You can explain every line to a colleague without notes
- [ ] Logic-heavy code (capacity maths, sprint generation, dependency checks, exports) has unit tests that pass
- [ ] No data-loss path introduced (the spec's one unforgivable failure)
- [ ] State changes go through the action/event pattern (multiplayer insurance)
- [ ] Build log entry written

## The Build Log (the Capstone artefact)

One markdown file (or folder of dated entries) in the repo. Each entry captures:

- **Date / task brief**: what was directed
- **AI contribution**: what the AI proposed and produced (summarise, link commits)
- **Human contribution**: decisions made, corrections issued, code rejected and why
- **Friction**: where the AI went wrong, hallucinated, over-engineered, or needed steering
- **Verdict**: what worked, what you would direct differently next time
- **Time**: rough effort spent (gives you a velocity story for the write-up)

**Log honestly.** "AI nailed it in one prompt" and "AI confidently produced broken capacity maths three times" are both valuable. The Capstone story is the directing skill, not AI cheerleading.

## Guardrails and Anti-Patterns

**Hard rules:**

- **No unexplained code merges.** If you don't understand it, it doesn't land
- **No silent scope additions.** AI suggesting "while we're here, we could also..." goes to the P1/P2 parking lot, not the diff
- **No architecture by accident.** Library and pattern choices are briefed decisions, not whatever the AI defaulted to
- **No skipping the propose step** on non-trivial work. Cheap prompt, expensive rewrite
- **Trust but verify on tests.** AI-written tests are reviewed for what they actually assert, not just that they pass. A test that asserts nothing is worse than no test

**Watch for (log when seen):**

- AI over-engineering simple problems (abstraction layers nobody asked for)
- Plausible-but-wrong domain logic (capacity maths, date/sprint arithmetic are prime risk areas)
- Stale library knowledge (verify current APIs for the drag-and-drop and any sync library)
- Context drift in long sessions (re-anchor with the spec; start fresh sessions for new features)

## Tooling Decisions (locked before first session)

- **AI tools and model split**:
  - **Claude (Fable 5) in the Claude Windows desktop app**: planning, specs, user journeys, document drafting, build log review, and second-opinion code/architecture review. Has live filesystem access to this repo's /docs
  - **Claude Code (Opus 4.8) in VS Code**: the entire build (scaffolding, features, tests, refactors). Rationale: this is a well-specced, brief-by-brief, client-side build; Opus 4.8 is strong at exactly this and Fable consumes usage limits ~2x faster for capability this governance model deliberately constrains
  - **Escape hatch**: `/model fable` for a single Claude Code session if a genuinely hard problem appears (sprint/date arithmetic edge cases, action/event state design), then switch back. Log any such escalation and whether it was worth it
- **Repo**: https://github.com/davidmjackson/plan (`git remote add origin https://github.com/davidmjackson/plan.git`)
- **Repo checklist before first push**: licence chosen and committed; no secrets in history (run gitleaks or equivalent); README stub with project name, one-line pitch, link to spec and build log; Dependabot/security alerts enabled if public
- **Branch discipline**: feature branches per brief, even solo (makes the log auditable against commits)
- **Stack**: per spec technical notes, consistent with suite

## Success Measures for the AIDE Experiment

- **Velocity**: MVP (spec P0) shipped within the 2-4 week target, effort logged
- **Quality**: zero data-loss bugs post-launch; you can explain 100% of shipped code
- **Evidence**: build log complete enough that a hiring manager or assessor can reconstruct how the product was directed
- **Judgement growth**: by the final entry, your briefs should be visibly sharper than your first ones. Note the difference in the closing retrospective

## Closing Retrospective (write at MVP launch)

- What did directing AI engineering actually require that writing code does not?
- Where was AI fastest? Where was it most dangerous?
- What would your rules of engagement v2 say?
- Honest ratio: how much time directing/reviewing vs how much saved building?

---

**Scope rule for this doc**: these rules apply to the sprintplan MVP build. Revise at MVP launch, not mid-build. Mid-build rule changes go in the log as friction, then into v2.
