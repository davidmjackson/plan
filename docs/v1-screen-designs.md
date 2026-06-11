# sprintplan.uk - v1 Screen Designs (v1.0)

**Status**: Design rulings closed by owner, 11 June 2026. Ready for build briefs.
**Owner**: [You]
**Companions**: sprintplan-mvp-spec.md (v0.5), user-journeys.md (v1.0)
**Date**: 11 June 2026

This document is the screen-level contract for the MVP build. It records the eight design rulings (G1-G8) taken on 11 June 2026 and specifies the five v1 screens against the suite's Instrument theme. Anything not specified here defers to the spec; anything conflicting with the spec is a bug in this document.

---

## Design rulings (closed 11 Jun 2026)

| # | Question | Ruling |
|---|---|---|
| G1 | Plan start date (missing from spec) | Added to P0 #1 as spec errata. Default: next Monday. Editable in the settings strip, first item |
| G2 | Partial final sprint capacity | Prorated: adjusted capacity x (partial days / full sprint days), rounded to nearest whole point, minimum 1. Pill reads e.g. `0 / 9 (partial)` |
| G3 | Settings change with placed stories | Sprints keep identity by index. Stories in removed sprints return to the top of the backlog with a toast. Sprint length changes re-date containers, placements persist by index. Velocity/buffer changes only recompute pills. No settings change ever deletes a story or epic |
| G4 | App accent colour | New hue added to instrument-core: plum, approx `oklch(0.50 0.10 290)` plus wash, bound to `data-app="plan"`. Amber and red remain reserved for capacity semantics |
| G5 | Points input | Fibonacci chips (1, 2, 3, 5, 8, 13, 21) plus free positive-integer entry. Consistent with sprintpoker's deck |
| G6 | Plan title | Optional text field. Shown in band h1, resume prompt, and every export header. Spec errata alongside G1 |
| G7 | Dependency picker scope | Any story is pickable, including backlog. Violations evaluate only when both stories are scheduled. Backlog-side pairs show neutral badges |
| G8 | Save/load vs export | Board file (.json save/load) lives in the top bar. Report export lives in the export dialog. Never mixed |

---

## Suite branding and tokens

**Source of truth**: `instrument-core.css` (currently in the retrospective repo at `public/css/`). sprintplan inherits it wholesale; do not fork tokens.

- **Fonts**: Bricolage Grotesque 700 (display/h1-h3), Hanken Grotesk 400-700 (UI), IBM Plex Mono (micro-labels and every number: points, capacity, dates, counts). The mono treatment is the suite's "this is data" signal and is mandatory on this board
- **Surfaces**: `--bone` page, `--panel` cards/containers, `--line` / `--line2` borders
- **Chrome**: standard `.topbar` (brand glyph + name, suite links, actions right), `.band` with waves + eyebrow + h1, then the working surface. A `#glyph-plan` symbol must be added to the shared `glyphs.svg` sprite
- **App accent (G4)**: add to instrument-core:
  - `--plum: oklch(0.50 0.10 290); --plumwash: oklch(0.95 0.03 290);`
  - `.ins[data-app="plan"] { --accent: var(--plum); }`
  - Accent is used for focus rings, primary buttons, selected chips, and epic-adjacent UI. It is never used for capacity state
- **Capacity semantics (reserved)**: neutral = default pill, amber = `--amber`/`--amberwash`, red = the existing danger treatment. These three colours mean capacity state and nothing else on this board
- **Epic colours**: a small fixed palette (6-8 hues drawn from the theme family, plum first) assigned in rotation at epic creation, changeable in the epic editor

---

## Screen 1: Board view

Three vertical zones inside standard suite chrome. Time runs top to bottom (spec resolved decision 5).

### Layout

- **Month rail (~48px, left)**: computed visual rail. Rotated month labels in mono caps, one segment per month, segment height spans the sprints assigned to it. Sprint-to-month assignment by majority of days; on a tie (e.g. a 14-day sprint split 7/7), the earlier month wins. The rail is never a drop target and holds no data
- **Sprint stack (flexible, centre)**: sprint containers stacked in order. Scroll is the page scroll; no inner scrolling regions
- **Backlog panel (~280px, right)**: epics as collapsible groups, stories beneath. Right-hand placement keeps the time axis clean on the left and mirrors the Jira backlog-to-sprint drag direction

### Sprint container anatomy

- **Header**: sprint name (Sprint 1...), date range (mono), capacity pill (mono) showing `placed / capacity`
- **Pill states**: total <= capacity neutral; over by <= 10% amber; over by > 10% red. Thresholds computed from adjusted capacity, which is velocity x (1 - buffer%), prorated for a partial final sprint (G2)
- **Honesty nudge**: when over capacity, a slim banner renders inside the container: "Over committed by N pts. Relabelling it a stretch goal does not add capacity." Non-blocking, dismissible per sprint per session; reappears next session if still over
- **Partial final sprint**: dashed container border, `partial` tag in the header, prorated capacity in the pill
- **Empty state**: muted "Drop stories here"

### Story card anatomy (board side)

- Epic colour dot, story title, points chip (mono), dependency badges (D1, D2...)
- **Violation state**: when a blocked story sits in an earlier sprint than its prerequisite, both cards take a red border and their shared badge turns red
- **Same-sprint tether**: a short connector between the pair, always visible. Cards are never auto-moved
- **Cross-sprint connector**: drawn on hover/select of either card only. Badges stay visible at all times
- **Stack order**: drag to reorder within a sprint is free and is facilitation theatre only; it never affects totals, warnings, or exports (spec resolved decision 6)

### Backlog panel

- Header: "Backlog", "+ Epic" button
- Epic group row: collapse chevron, colour dot, epic title, `stories · unplaced pts` in mono. Click opens the epic editor
- Story rows: title + points (mono), draggable. Click opens the card editor
- "+ Story" button per epic group
- Stories with backlog-side dependency pairs show their neutral badge (G7)

### Drag and drop

- Backlog to sprint, sprint to sprint, sprint to backlog, reorder within sprint. Totals and pill states update on drop, instantly
- Every move is a discrete store action (multiplayer insurance, RoE quality gate)

---

## Screen 2: Card editor (with dependency picker)

A centred modal. It is the single home for dependency create/remove (journey sign-off); the board only renders badges, tethers, and connectors.

### Fields

1. **Title** (required)
2. **Epic** (select, includes "+ New epic" inline create)
3. **Points** (G5): chip row 1 2 3 5 8 13 21 plus a free entry accepting any positive integer
4. **Summary** (textarea, optional)

### Dependencies section

- Existing links listed as rows: shared badge, direction ("needs" / "blocks"), paired story title, paired story location in mono, remove x
- A violating pair renders its row in the red treatment with the location annotated (e.g. "Sprint 2 · after this"), so the mistake is visible at creation time, not only on the board
- **Add dependency**: two buttons matching journey language, "This blocks..." and "This needs...". Either opens the picker
- **Picker**: search input plus a list of all other stories grouped by location (Sprint 1, Sprint 2... Backlog). Excluded: the current story, stories already paired with it. Selecting a story creates the pair, assigns the next D number, closes the picker. Backlog stories are pickable; violations evaluate only when both sides are scheduled (G7)

### Footer and variants

- Footer: "Delete story" (left, danger-ghost, inline confirm), Cancel / Save (right)
- **Epic editor**: same modal minus points and dependencies, plus the colour dot picker. Deleting an epic with children prompts: delete the stories too, or move them to "No epic". No orphaned state
- Escape = Cancel. Unsaved-changes guard on escape/overlay click if fields are dirty

---

## Screen 3: Resume / New plan prompt

Shown only when a saved board exists in local storage. No silent resume (journey sign-off).

- **Resume card (primary, default action)**: plan title (G6) or "Untitled plan", "Last edited [relative time]", summary line in mono: `3 months · 6 sprints · 14 stories · 47 pts placed`
- **Start new plan (secondary)**: warns it replaces the saved board; offers "Download current board first (.json)" inline. This is the only destructive path in the app and it ships with its own escape hatch
- **Import a board (.json)**: tertiary text link
- Escape/dismiss resumes. Nothing destructive is reachable by accident

---

## Screen 4: Settings strip (inline setup)

No wizard (journey sign-off). A persistent one-line strip between the band and the board, every value click-to-edit in place:

`starts [Mon 6 Jul] · [3 months] · [2-week] sprints · velocity [20] · buffer [10%] -> capacity 18 pts`

- **Defaults (first run)**: start = next Monday (G1), duration = 3 months, sprint length = 2 weeks, velocity = 20, buffer = 10%. Board renders instantly; the strip is gently highlighted for ~5 seconds as the edit affordance
- **Controls**: start date = date popover; duration and sprint length = select popovers; velocity and buffer = numeric steppers. Derived capacity is read-only and updates live
- **Plan title (G6)**: editable in the band h1 (click to edit), not in the strip. Placeholder "Untitled plan"
- **Regeneration rules (G3)**, normative:
  - Sprints keep identity by index (Sprint 1 is always the first container)
  - Duration shrink: stories in removed sprints return to the top of the backlog; toast: "N stories returned to backlog"
  - Sprint length change: containers re-date and re-count; placements persist by index; any stories in indexes beyond the new count return to backlog as above
  - Start date change: re-date only; placements untouched
  - Velocity/buffer change: recompute pills and nudges only
  - No settings change ever deletes a story or epic (zero data loss bar)

---

## Screen 5: Export dialog (and save/load placement)

**Separation (G8)**: report export lives in this dialog, opened from the top bar "Export plan" button. Board persistence (.json download / import) lives under a separate top bar "Save / load" control. Never mixed.

- **Three format cards**: Markdown (primary: copy to clipboard; secondary: download .md), Printable HTML (open print-ready tab + download), CSV (download, flat, one row per story)
- **Report contents note** (always visible): sprints and stories, points vs capacity, dependency warnings, and the over-commitment section. Shown even when the plan is clean so the honesty section is known before it is needed
- **Warning count chip**: if over-commitments or violations exist, the dialog shows "N warnings will be included". Informational, never blocking
- All three renderers consume the same data template (spec resolved decision 3). Plan title (G6) heads every format

---

## Cross-cutting rules

- **Autosave**: every store action persists to local storage immediately. Refresh loses nothing
- **Target viewport**: design for >= 1280px (facilitator screen-sharing in Teams). Below that, the backlog panel collapses to a toggleable drawer; no mobile layout in v1
- **Legibility under screen share**: minimum 13px body on the board, mono numbers at 12px+, pill states distinguishable by label text as well as colour (e.g. amber/red pills carry the over-by figure), never colour alone
- **Dark mode**: parked at P1 per spec; tokens already support it via the theme, do not block on it
- **Out of scope reminders**: no objectives row, milestone row, team lanes, confidence votes; no hover-based dependency actions; no auto-moving cards

---

## Change log

- **v1.0 (11 Jun 2026)**: Initial version. G1-G8 rulings recorded; five screens specified against the Instrument theme.
