# Build state after Brief 8 — handoff for the next brief

**Purpose**: Ground the next brief in what the code *actually is* after Brief 8, not just what the specs say. Drafted by Claude Code (Opus 4.8) from the live build; intended for the Claude app (Fable) when authoring Brief 9 (Exports — P0 #6, the last untouched P0).
**As of**: branch `brief-8-dependencies-drawing` off `main`. Tree: feat + build-log drafted, **129 unit tests green**, `tsc --noEmit` clean, **22 headless Chromium checks, zero console errors**. PR pending the director's sign-off of the build-log entry.
**Companions**: sprintplan-mvp-spec.md (v0.5), v1-screen-designs.md (v1.0), user-journeys.md (v1.0), aide-rules-of-engagement.md, build-log.md, build-state-after-brief1.md…build-state-after-brief7.md, housekeeping-dragula-vendoring.md, brief8.md.

---

## What Brief 8 shipped

**Dependencies — the board drawing layer (P0 #5, slice 2 of 2).** The half split away from Brief 7: the app's **first drawn SVG layer**, a PURE VIEW over the slice-1 model. **No new action, no schema change, no store change, no `storyCard` signature change.** With this slice the dependency feature is **complete end to end**: model + card-editor + badge (slice 1) and now the board layer + board-side red (slice 2).

- **One pure selector** added: `connectorsToDraw(state)` in `dep-selectors.js`, returning the drawable set — one entry per pair with BOTH endpoints placed in sprints (`{ dep, blockerId, blockedId, fromIndex, toIndex, kind, violation }`; `kind` "tether" when `fromIndex === toIndex` else "connector"; backlog-touching pairs excluded, R3/G7). Unit-tested first (5 cases, 124 → 129 tests).
- **One view module** added: `connectors.js`, owning a single `<svg>` overlay and its own module-level hover state. The board sees its dependencies as the facilitator drags, and an out-of-order pair turns red on the board, not only in the editor.

Built TDD pure-first for the selector, browser-verified for the SVG (the same DOM boundary Brief 3's drag and Brief 6/7's prompt/picker sit on).

---

## Architecture as built (the contract Brief 9 extends)

Everything from briefs 1–7 still holds. Brief 8 changed **no model, no action, no schema** — it is a view. Load-bearing facts the next brief should know:

- **The board is a vertical stack.** `render.js` builds one CSS grid (`grid-template-columns: 48px 1fr`): column 1 the month rail, column 2 a full-width sprint ROW per sprint (`el.style.gridRow = sprint.index + 1`); cards are a vertical list in `.sprint-body`. No team/swimlane dimension. A cross-sprint link is a line DOWN the column; a same-sprint tether is a short link within one list.
- **`renderBoard` tears the board down with `board.replaceChildren()` on every dispatch, then rebuilds it.** The SVG overlay is therefore recreated every render (it is the board's LAST child) and endpoints are re-queried by `[data-story]` after layout — element references are never cached across renders.
- **Nothing scrolls internally** — `.board`/`.workspace` have no `overflow` or height cap; the board grows to content and the PAGE scrolls. `#board` is now `position: relative`; the SVG is sized to the board's content box and measured in board-local coordinates (`getBoundingClientRect()` minus the `#board` box), so it scrolls with the page for free. There is no zoom and no internal scrollport — do not build for either.
- **Hover/select state lives OUTSIDE the store (R6)**, module-level in `connectors.js` (like `backlog.js`'s collapsed Set and `banner.js`'s dismiss state). A single delegated `mouseover`/`mouseleave` listener is attached **once** to `#board` (which survives `replaceChildren`); a hover redraws ONLY the SVG, never the board.
- **A `suppressed` flag guards the drag (R7).** Because the pointer crosses cards *during* a drag, the hover handler would otherwise re-show the layer that drag-start hid. `hideConnectors()` (on dragula `drag`) sets `suppressed`; the hover handlers go inert; `redrawConnectors()` (on dragula `dragend`, covering BOTH drop and cancel) and the next full render clear it. This was a real bug the browser run caught.

### Board-side red (R5) — where the two red semantics live

`--red` now reads in **two non-overlapping places**, never on the same element:
- **Capacity** red/amber — the `.cap-pill` and the honesty banner (Brief 4). Unchanged.
- **Dependency violation** red — the card border (`.bl-story--dep-violation`), the D badge (`.dep-badge--violation`), and the connector stroke (`.dep-line--violation`). The editor row (slice 1) was the first; slice 2 adds the board.

So a violating card inside an over-capacity sprint is unambiguous: the pill is capacity-red, the card/badge/connector are violation-red. The card and badge red render **at rest**, driven by the violation flag **already carried** in the `badges` array `storyCard` is handed — so no signature change (R2). It is backlog-safe by construction: `isViolation` is false whenever an endpoint is in the backlog (G7), so backlog cards/badges never light up (R3). Only the connector *line* is hover-gated.

### State shape, actions, schema — UNCHANGED

Still `schemaVersion: 2`, the `deps: [{ id, blockerId, blockedId }]` top-level array, **17 actions**, `validatePlan` the load-path spine. Brief 8 added a selector and a view, nothing else.

### Pure functions available (all unit-tested, DOM-free)

As after Brief 7, plus **`connectorsToDraw(state)`** in `dep-selectors.js` (the only addition). `isViolation`, `storyLocation`, `depBadges` (violation flag carried), `depLabel` etc. all unchanged and now consumed by the board layer too.

### View / glue modules

As after Brief 7, plus:
- **`connectors.js` (new)** — the SVG overlay. `drawConnectors(state)` (called as renderBoard's last step), `hideConnectors()` / `redrawConnectors()` (the drag hooks), module-level `svg`, `hoveredStoryId`, `lastState`, `wired`, `suppressed` (`lastState` lets a hover redraw recompute geometry with no new dispatch; `wired` guards the once-only delegated listener). Right-gutter cubic bows; a shared arrowhead marker (`fill: context-stroke`) at the blocked/dependent end follows the stroke colour. Tethers always visible; cross-sprint connectors on hover (R4).
- **`render.js`** — `#board { position: relative }`; `drawConnectors(state)` as the last step of `renderBoard`.
- **`drag.js`** — `hideConnectors()` on `d.on("drag")`, `redrawConnectors()` on `d.on("dragend")`. (NB: the drag lifecycle lives in `drag.js`, not `main.js` — `main.js` only calls `setupDrag()` after each render.)
- **`backlog.js` `storyCard`** — adds `.bl-story--dep-violation` (any carried `badge.violation`) and `.dep-badge--violation` per badge. Signature unchanged (reads the flag it is already passed).
- **`plan.css`** — a dedicated neutral `--dep-line` token, `.dep-layer` (absolute, `pointer-events: none`), `.dep-line` / `.dep-line--violation`, and the card/badge violation modifiers.

---

## Known limitations / notes carried into Brief 9

- **Cycle detection is still deferred (by ruling).** Unchanged from slice 1: self-dep + duplicate-pair rejected at picker + load boundary; the duplicate check is **directional** (a reverse pair A↔B is not a duplicate and passes validation); a true cycle yields honest mutual violation flags, no DFS.
- **`validatePlan` does not shape-guard each `deps` element.** `deps: [null]` throws at the load boundary instead of returning a clean `{ ok: false, reason }`. The picker can't produce it and our saves never will — only a hand-edited/corrupted file reaches it. **The natural home for the one-line object guard is the Exports brief (P0 #6)**, which already touches the I/O surface.
- **The D number renumbers on removal** (derived, intended). A within-session aid, not a stable reference.
- **Connectors are hover-only, no click-pin.** Click is taken by `edit-story` (and swallowed by the drag), so a selection-pin gesture was deliberately not added this slice. If a pinned/persistent connector view is ever wanted, it is a defined addition (e.g. show connectors for the story whose editor is open), not a bug.
- **Doc/code naming note still stands** (from Brief 6): `extractPlan`'s upload mode is `"file"` in code.

---

## What Brief 9 (Exports, P0 #6) will need — the last untouched P0

The markdown / printable-HTML / CSV plan summary with a dedicated **over-commitment section** and **dependency-violation warnings**. Everything it needs is ready-made:

- **`overBy(placed, capacity)`** in `plan-maths.js` (Brief 4) — the over-commitment list per sprint.
- **`isViolation(state, dep)`** in `dep-selectors.js` (Brief 7, now complete end to end) — the dependency-violation warnings. `connectorsToDraw` is a board-view helper, but `isViolation` / `depsForStory` are the export-facing reads.
- **`planSummary(state)`** in `board-selectors.js` (Brief 6) — title/months/story counts for a report header.
- A separate control (G8): the report export is its own control, distinct from the board file Save/Import (which is `exportPlan`/`extractPlan` for the round-trippable .json, NOT a report).
- **Two slice-1 I/O notes are the natural fit here** (above): the directional duplicate check and the `deps`-element shape-guard. Both touch the I/O surface this brief already opens.

It dispatches nothing (a report is a pure render of state) and needs no new action or schema change — same shape as this slice.

## Deferred (candidate scope, in spec P0 order)

- **Brief 9 — Exports** (P0 #6) — next; see above. The last untouched P0; after it, all P0 scope is shipped.
- Stretch toggle, labels, parked lane, stats strip (P1). Sub-1280px backlog drawer; dark mode. A persistent/mid-session New-plan control (Brief 6 R4 deferred it); multiple boards (P2). A horizontal/swimlane board re-orientation (a separate, larger board brief, explicitly out of scope of the dependency slices).

## Open housekeeping (logged, not yet actioned)

- **Theme-token promotion still open** (carried, now grown): promote `--plum`/`--plumwash`, `#glyph-plan`, the 8 epic-palette tokens **and the new `--dep-line`** to the shared instrument-core source; register `plan` as a SURFACE in the theme `manifest.mjs` and add the `check-theme-drift` test. Suite-level, out of scope for a feature brief.
- **Dragula vendoring decision stands** (`docs/housekeeping-dragula-vendoring.md`): keep per-app copies; a shared suite copy is a suite-level change against a second live app, out of scope for any single feature brief.

## Branch / merge model (as now practised)

`main` carries briefs 1–7. **Brief 8 is on `brief-8-dependencies-drawing`, branched off `main` after PR #5 merged** (no stacking). PR pending the director's sign-off of the build-log entry; merge with `gh pr merge --merge` (merge commit, not squash/rebase) so the build-log's per-brief SHA references stay valid. Merged feature branches can be pruned when convenient.

## Commands

```
npm test               # node --test tests/*.test.js, 129 tests
npm run typecheck      # tsc --noEmit, scoped to public/js
npm start              # serve on http://localhost:3004
```

Headless browser verification: no Playwright in this repo; require it from the sibling (`/var/www/retrospective/node_modules/playwright`) in a CommonJS script. The localStorage state key is `sprintplan:board` (a `{ savedAt, plan }` envelope — unwrap `.plan`); autosave fires on dispatch, not on init. To seed real state for a browser test, build it in-page via dynamic `import("/js/store.js")` + the real reducers, inject the envelope, reload, and click `.rp-resume` (a valid save raises the Brief 6 prompt). For the SVG layer specifically: the overlay is `svg.dep-layer`; connectors are `path.dep-connector` (hover-gated), tethers `path.dep-tether` (always on), violation strokes carry `.dep-line--violation`; park the pointer in a corner before asserting "at rest" (a card under the pointer legitimately shows its connector).

---

## Suggested next brief

**Brief 9 = Exports (P0 #5 done; this is P0 #6, the last untouched P0).** Rationale: the dependency feature is complete, so the natural next cut is the report export — markdown / printable-HTML / CSV with the over-commitment section (reusing `overBy`) and the dependency-violation warnings (reusing the now-complete `isViolation`). It is a separate control from the board file I/O (G8) and, like this slice, a pure render of state with no new action or schema change. (Suggestion only — scope order is the director's call.)
