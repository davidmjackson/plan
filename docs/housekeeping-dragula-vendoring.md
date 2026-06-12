# Housekeeping note — dragula is vendored twice (decision-ready, NOT actioned)

**Status**: raised by Brief 4, not actioned. No files moved. This note records the decision so it can be taken deliberately at the suite level, not slipped into a feature brief.
**Raised**: 2026-06-12 (Brief 4).

## The duplication

Two identical copies of dragula exist, one per app:

- `plan/public/vendor/dragula/dragula.min.js` + `dragula.min.css`
- `retrospective/public/vendor/dragula/dragula.min.js` + `dragula.min.css`

Both apps load it the same way — a global `<script>`/`<link>` from `/vendor/dragula/` in their own `index.html` (plan) / page (retrospective), read as `window.dragula`. Same two files, same version, byte-identical.

## Options

1. **Single shared suite vendor location** both apps reference (e.g. under the suite's shared static root), each app's HTML pointing at the one copy.
2. **Status quo** — each app keeps its own copy under its own `public/vendor/`.

## Trade-offs

| | Shared copy (option 1) | Per-app copy (option 2, current) |
|---|---|---|
| Source of truth | One — single version pin, one place to patch/upgrade | Two — can drift in version |
| Serving / load path | Requires a change to both apps' load paths **and** the suite's shared serving setup | No change; each app self-contained |
| Coupling | Cross-app coupling: a shared-copy upgrade affects both live apps at once | Apps independent; upgrade one without touching the other |
| Risk | Touches a second live app (retrospective) and infra outside this repo | None beyond the existing trivial duplication |

## Recommendation

**Keep per-app copies for now (option 2).** The duplication is two small static files at a pinned version; the cost is near zero. The shared-copy benefit (one version pin) only pays off if dragula is upgraded often, which it is not. Consolidating would touch a second live app and the suite's shared serving layer — disproportionate to the problem, and exactly the kind of cross-cutting infra change that should be a deliberate suite-level ticket, not a side effect of a feature brief.

## What actioning option 1 would touch

- both apps' `index.html` (plan) / page templates (retrospective) load paths;
- the suite's shared static-serving setup, which **lives outside this repo**.

Because the shared location and a second live app are outside `plan/`, the actual move is a **separate suite-level change against a second live app** and is therefore **out of scope for any single feature brief** (RoE: no architecture by accident, no silent cross-repo refactor). If taken, it should be its own suite ticket with both apps verified after.

## Related carry-forward (also still open, not actioned)

Promote `--plum` / `--plumwash`, `#glyph-plan`, and the 8 epic-palette tokens to the shared `instrument-core` source; register `plan` as a SURFACE in the theme `manifest.mjs` and add the `check-theme-drift` test.
