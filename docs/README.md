# sprintplan docs — structure and archive guide

This directory holds the **live** planning and reference documents for sprintplan.uk.
Superseded history (per-brief instructions, old build-state snapshots, the multiplayer
spike exploration, the completed MP slice briefs) lives in **`docs/archive/`**.

If you are Claude Code (Fable) picking up work: read the live docs below, and trust the
live **source** over any handoff prose where they disagree. Source-grounding has caught
real doc/code drift on this project more than once.

## Live documents (this directory)

**Reference / source of truth**
- `sprintplan-mvp-spec.md` — the product spec (v0.5): P0/P1 scope and the resolved decisions.
- `v1-screen-designs.md` — the signed-off screen designs (v1.0).
- `user-journeys.md` — the signed-off user journeys (v1.0).
- `aide-rules-of-engagement.md` — the RoE cadence every brief follows (PROPOSE before build, TDD, branch-per-brief, build-log sign-off).

**Current state and running record**
- `build-state-after-phase2-build5.md` — the most recent build-state handoff (live cursors + coloured avatars); the latest comprehensive map of the code. Where it and the source disagree, the source wins.
- `build-log.md` — the running, append-only build log (the Capstone artefact). New entries are appended here; it is never archived.

**Operational / standing decisions**
- `demo-data.md` — how to load, clear, and regenerate the demo/UAT sample plan.
- `phase2-mp6-deploy-runbook.md` — the deploy/operate runbook for the multiplayer service.
- `housekeeping-dragula-vendoring.md` — the standing decision to keep per-app dragula copies.

**Active work (new naming convention)**
- `phase2-buildN.md` — the current phase-2 build brief, numbered and incrementing. Only the latest brief stays live here (paired with the latest build-state); shipped briefs move to `docs/archive/`. The live brief is currently `phase2-build5.md` (live cursors + coloured avatars).

## Archive (`docs/archive/`)

Historical, superseded, or completed documents. Kept for the build-log's per-brief SHA
references and for project history; **not** current working docs.

- `brief1.md` … `brief10.md` — the per-brief instructions for the MVP P0 track (briefs 1–10). All shipped and merged; the live source and `build-state-after-brief10.md` are the current truth.
- `build-state-after-brief1.md` … `build-state-after-brief9.md` — superseded build-state snapshots, each the ground-truth handoff for one brief, all superseded by `build-state-after-brief10.md`.
- `phase2-multiplayer-feasibility.md`, `phase2-multiplayer-spike-brief.md`, `phase2-multiplayer-spike-build-brief.md`, `phase2-multiplayer-spike-propose.md`, `phase2-multiplayer-spike-finding.md` — the multiplayer feasibility study and spike exploration that produced the GO decision.
- `phase2-mp1-client-sync-brief.md`, `phase2-mp2-company-auth-brief.md`, `phase2-mp2-hub-registration.md`, `phase2-mp3-conflict-refine-brief.md`, `phase2-mp4-collab-bridge-brief.md`, `phase2-mp5-presence-brief.md`, `phase2-mp6-deploy-brief.md` — the per-slice multiplayer productionise briefs (MP1–MP6). All shipped; the live source is the truth. (The MP6 deploy **runbook** stays live in `docs/` as an operational doc.)
- `phase2-build1.md` … `phase2-build4.md` (and `phase2-build2-pr27-commit-runbook.md`) — the post-launch build briefs (build1 dependency-in-a-room fix, build2 connector arrowhead, build3 demo/clear+capacity bar+return-to-backlog, build4 collaboration polish). All shipped and merged; the build-log + build-states are the current truth. Their per-build build-states (`build-state-after-phase2-build1..4.md`) are archived alongside.

## Conventions going forward

- New documents live in `docs/`. When a document is superseded, or its work is fully shipped and captured by `build-log.md` + the latest build-state, move it to `docs/archive/`.
- New build briefs use the `phase2-buildN.md` naming, incrementing as needed.
- `build-log.md` and the latest build-state stay live in `docs/`.
- When in doubt about current behaviour, read the source under `public/js/` and `server/`, not the prose.
