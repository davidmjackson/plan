> **Archived 16 Jun 2026 — all items actioned.** §2a (status-line refresh + change-log + P1 annotation, director signed off), §2b (build6 brief correction banner), and §2c (README archive bullet) are all applied. The §1 next-merge archive trigger lives on as the standing README convention; §4 items are tracked in the latest build-state / build-log / dragula note. §1's "in root, correctly live" list below is frozen as of `c2c1fc0` and is no longer current.

# Housekeeping note — docs audit: archiving + stale timeline (decision-ready, mostly NOT actioned)

**Status**: raised by a docs audit, source-grounded against the live build at `c2c1fc0`. Records what to move/fix so it is done deliberately, not slipped into a feature brief. Two items are safe-to-apply; the rest are director-gated because they touch signed/reference docs.
**Raised**: 2026-06-16 (post phase2-build6).
**For**: Claude Code (Fable). Read the live source over this prose where they disagree (the README's standing rule).

---

## TL;DR

- **Nothing needs archiving right now.** Root correctly holds only the current brief (`phase2-build6.md`) + current build-state (`build-state-after-phase2-build6.md`) plus the evergreen reference/operational docs. The archive convention is being followed.
- **Two live docs carry stale/old timeline** and should be corrected: the **MVP spec status line** (still says "ready for build briefs" when the MVP + Phase 2 + builds 1-6 have shipped) and the **build6 brief** (a known file misattribution, already corrected in the log/state but not in the brief itself).
- **`build-log.md` and the latest build-state are current** through build6 (PR #38, `c2c1fc0`). No action.

---

## 1. Archive status — nothing to move

The current state is clean. For the record, so the next session does not re-audit:

- **In root, correctly live**: `README.md`, `sprintplan-mvp-spec.md`, `v1-screen-designs.md`, `user-journeys.md`, `aide-rules-of-engagement.md`, `build-state-after-phase2-build6.md`, `build-log.md`, `demo-data.md`, `phase2-mp6-deploy-runbook.md`, `housekeeping-dragula-vendoring.md`, `housekeeping-doc-audit.md` (this file), and the live brief `phase2-build6.md`.
- **Archive is complete**: briefs 1-10, build-states after brief1-10, the spike + MP1-6 briefs/findings, and phase2-build1-5 + their build-states are all in `docs/archive/`.

**The rule for the NEXT build (so the trigger is unambiguous):** when `phase2-build7.md` (or whatever the next brief is named) ships and merges, move BOTH `phase2-build6.md` AND `build-state-after-phase2-build6.md` into `docs/archive/`. `build-log.md` and the new latest build-state stay live. Per README conventions.

---

## 2. Docs with wrong / old timeline (the actual work)

### 2a. `sprintplan-mvp-spec.md` — stale status line (director-gated; recommended)

**Problem.** The header still reads the pre-build state:

> **Status**: Decisions locked, user journeys mapped, v1 screens designed (docs/v1-screen-designs.md), ready for build briefs

That was true before brief1. Reality now: MVP P0 (briefs 1-10) shipped, Phase 2 live multiplayer (spike → MP1-MP6 → launch) shipped, and post-launch builds 1-6 shipped including the P1 stretch toggle. "ready for build briefs" actively misleads anyone picking the doc up.

**Why director-gated.** This is a signed reference spec. RoE: no silent rewrite of a signed doc. The body (problem, goals, P0/P1, resolved decisions) is still the locked reference and should NOT be rewritten — only the status line refreshed and a change-log line added.

**Recommended edit (apply verbatim on director OK).** Replace the Status line with:

> **Status**: SHIPPED. MVP P0 (briefs 1-10) and Phase 2 live multiplayer (spike → MP1-MP6 → launch) are live; post-launch builds 1-6 shipped, including the P1 stretch toggle (phase2-build6). This remains the locked reference for the original P0/P1 scope and resolved decisions; current behaviour lives in the latest build-state and the source.

And add to the top of the Change Log:

> - **Status refresh (16 Jun 2026)**: No scope change. Status line updated to reflect shipped state (MVP + Phase 2 multiplayer live; build6 shipped the P1 stretch toggle). Body unchanged; this stays the locked reference spec.

**Low-priority follow-on (optional, same gate).** In "Nice-to-Have (P1)", the "Story-level stretch toggle" bullet is now shipped; annotate it `(shipped — phase2-build6)` so the P1 list does not read as all-pending. Leave the rest of the P1 list as-is.

### 2b. `phase2-build6.md` — known file misattribution (SAFE TO APPLY)

**Problem.** The brief's "Read first" and "Files (anticipated) → Modified" attribute the shared `storyCard` renderer (and the stretch chip + toggle) to `public/js/render.js`. It actually lives in `public/js/backlog.js`; `render.js` only imports and calls it (`import { renderBacklog, storyCard } from "./backlog.js"`) and was untouched by this build. Already corrected in `build-log.md` (2026-06-16) and `build-state-after-phase2-build6.md`, but the brief itself still carries the error, which matters once it lands in the archive as history.

**Why safe to apply.** This only prepends a factual correction banner. It changes no ruling, scope, or asserted outcome.

**Recommended edit (apply).** Add at the very top of `phase2-build6.md`, above the first line:

> **Correction (16 Jun 2026, post-build):** the shared `storyCard` renderer lives in `public/js/backlog.js`, NOT `render.js` as the "Read first" and Files lists below state. The chip + toggle shipped in `backlog.js`; `render.js` needed no change. The reducer also guards an unknown id (`if (!(id in state.stories)) return state`) beyond the literal snippet below, so a stretch mark on an unknown id is a safe no-op rather than a phantom story. See `build-log.md` (2026-06-16) and `build-state-after-phase2-build6.md`. The brief is otherwise source-accurate.

### 2c. `README.md` — tiny archive-list completeness gap (SAFE TO APPLY, low priority)

The archive section lists `build-state-after-brief1.md … build-state-after-brief9.md` as superseded by `build-state-after-brief10.md`, but `build-state-after-brief10.md` (which IS in `docs/archive/`) is not itself listed as an archived file. Trivial; for completeness, extend that bullet to read `build-state-after-brief1.md … build-state-after-brief10.md`, noting brief10's is the last MVP-track snapshot, itself superseded by the Phase 2 build-states.

---

## 3. Verified clean (do NOT re-audit these)

- `build-log.md` — current through build6 (entry 2026-06-16, director sign-off, PR #38 `c2c1fc0`). Append-only, never archived. No action.
- `build-state-after-phase2-build6.md` — the live contract; README points to it correctly. No action.
- `phase2-mp6-deploy-runbook.md` — evergreen operational runbook; ports match the live service (rooms on 3014, static on 3004/3014 dev). Correctly stays live. No action.
- `housekeeping-dragula-vendoring.md` — standing decision (keep per-app copies); not stale. No action. (Its own carried-forward theme-token item is tracked in §4 below.)
- `demo-data.md`, `v1-screen-designs.md` (v1.0), `user-journeys.md` (v1.0), `aide-rules-of-engagement.md` — reference docs, no timeline staleness found.
- Archive convention itself — documented in README and being followed. No action.

---

## 4. Standing / open items (tracked elsewhere — NOT doc cleanup)

Surfaced here only so they are not lost; these are real-work or suite-level tickets, not part of this doc audit. Source: `build-state-after-phase2-build6.md` "Known limitations / carried forward", the dragula note, and the build-log.

- **Theme token promotion (suite-level, open since Brief 1)**: promote `--plum` / `--plumwash`, `#glyph-plan`, and the 8 epic-palette tokens to the shared `instrument-core`; register `plan` as a SURFACE in the theme `manifest.mjs` and add the `check-theme-drift` test.
- **`@suite/auth-client` vendoring** — deploy-time dep, decision still open (deploy runbook §3).
- **Company-level entitlement** covers only the launcher's user.
- **Sibling theme re-sync** open at suite level; the retrospective `theme-manifest.txt` is stale (lists Fraunces/Inter; actual theme is Bricolage/Hanken) — suite housekeeping ticket.
- **dragula vendoring** — DECIDED per-app (`housekeeping-dragula-vendoring.md`); no action, recorded for completeness.
- **MP5 parking lot** — backlog cursors (build5 P3, easy follow-on), per-card "X is editing" indicators, cursors in modals, idle-timeout/smoothing/heartbeat, touch cursors, cross-tab dedupe.
- **Dependency cycle detection** — deferred (true cycle detection still parked; self/duplicate-pair rejection shipped).

---

## How to action (checklist for Fable)

Safe to apply now (factual, no scope/ruling change):
- [x] §2b — add the correction banner to `phase2-build6.md`. *(applied 16 Jun 2026)*
- [x] §2c — extend the README archive bullet to `…brief10.md`. *(applied 16 Jun 2026)*

Needs director OK first (touches the signed spec):
- [x] §2a — refresh the `sprintplan-mvp-spec.md` status line + add the change-log entry. *(director signed off; applied 16 Jun 2026)*
- [x] §2a follow-on — annotate the P1 stretch-toggle bullet `(shipped — phase2-build6)`. *(applied 16 Jun 2026)*

On the NEXT build merge (not now):
- [ ] §1 rule — archive `phase2-build6.md` + `build-state-after-phase2-build6.md` to `docs/archive/`.

Nothing in §3 or §4 is part of this audit; §4 items are their own tickets.
