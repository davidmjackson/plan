// @ts-check
/**
 * The plan summary export (Brief 9, P0 #6). ONE pure, DOM-free model
 * (reportModel) assembled from the existing selectors, and THREE pure string
 * renderers over it (toMarkdown / toHtml / toCsv). No renderer reaches past the
 * model into state (R1). The report READS state and returns strings: it
 * dispatches nothing, writes nothing, and never touches the autosave envelope
 * (R2) — that purity is what makes it safe and unit-testable. Escaping is
 * PER-RENDERER (each format's own special characters), and user input is never
 * emitted raw; the model holds the raw strings.
 *
 * Every figure reuses the established authority — planSummary, sprintCapacity,
 * pillState, overBy, isViolation, locationLabel, depLabel — so the report can
 * never disagree with the board.
 */

import { planSummary, sprintPlacedPoints } from "./board-selectors.js";
import { sprintCapacity, pillState, overBy } from "./plan-maths.js";
import { isViolation, locationLabel, depLabel, storyLocation } from "./dep-selectors.js";

/**
 * @typedef {import("./store.js").PlanState} PlanState
 * @typedef {{ title: string, summary: string, points: number, epicTitle: string | null, inViolation: boolean, stretch: boolean }} StoryRow
 * @typedef {{ name: string, startDate: string, endDate: string, isPartial: boolean,
 *   capacity: number, placed: number, pillState: "neutral"|"amber"|"red", overBy: number,
 *   stretchPoints: number, stories: StoryRow[] }} SprintBlock
 */

/**
 * Assemble the report data model from plan state. Pure and DOM-free; holds raw
 * (un-escaped) user strings — escaping is each renderer's job.
 * @param {PlanState} state
 * @returns {{
 *   header: { title: string | null, months: number, sprintCount: number, storyCount: number,
 *     startDate: string, endDate: string, totalPlacedPoints: number, totalCapacity: number },
 *   sprints: SprintBlock[],
 *   backlog: StoryRow[],
 *   overCommitment: Array<{ name: string, placed: number, capacity: number, overBy: number, stretchPoints: number }>,
 *   warnings: Array<{ label: string, blockerTitle: string, blockerSprint: string | null,
 *     blockedTitle: string, blockedSprint: string | null }>,
 * }}
 */
export function reportModel(state) {
  const { settings, sprints, stories, epics, meta, deps } = state;
  const summary = planSummary(state);

  // Story ids that are an endpoint of a VIOLATING pair (the CSV dependency flag);
  // reuses isViolation so it can never disagree with the warnings section.
  const violatingIds = new Set();
  for (const d of deps) {
    if (isViolation(state, d)) {
      violatingIds.add(d.blockerId);
      violatingIds.add(d.blockedId);
    }
  }

  const epicTitle = (/** @type {string | null} */ id) => (id && epics[id] ? epics[id].title : null);
  /** @param {string} id @returns {StoryRow} */
  const storyRow = (id) => {
    const st = stories[id];
    return {
      title: st.title,
      summary: st.summary,
      points: st.points,
      epicTitle: epicTitle(st.epicId),
      inViolation: violatingIds.has(id),
      stretch: st.stretch ?? false, // phase2-build6: per-story truth; absent = false
    };
  };

  /** @type {SprintBlock[]} */
  const sprintBlocks = sprints.map((sp, i) => {
    const placed = sprintPlacedPoints(state, i);
    const capacity = sprintCapacity(sp, settings);
    // phase2-build6: stretch points are a SUBSET annotation of the placed total —
    // stretch stories stay counted in full, so this never reduces `placed`.
    const stretchPoints = sp.placedStoryIds.reduce(
      (sum, id) => sum + (stories[id]?.stretch ? stories[id].points : 0),
      0,
    );
    return {
      name: sp.name,
      startDate: sp.startDate,
      endDate: sp.endDate,
      isPartial: sp.isPartial,
      capacity,
      placed,
      pillState: pillState(placed, capacity),
      overBy: overBy(placed, capacity),
      stretchPoints,
      stories: sp.placedStoryIds.map(storyRow),
    };
  });

  const totalCapacity = sprintBlocks.reduce((sum, b) => sum + b.capacity, 0);

  const header = {
    title: meta.title ?? null,
    months: summary.months,
    sprintCount: summary.sprints,
    storyCount: summary.stories,
    startDate: settings.startDate,
    endDate: sprints.length ? sprints[sprints.length - 1].endDate : settings.startDate,
    totalPlacedPoints: summary.placedPoints,
    totalCapacity,
  };

  const overCommitment = sprintBlocks
    .filter((b) => b.overBy > 0)
    .map((b) => ({ name: b.name, placed: b.placed, capacity: b.capacity, overBy: b.overBy, stretchPoints: b.stretchPoints }));

  const warnings = deps
    .filter((d) => isViolation(state, d))
    .map((d) => ({
      label: depLabel(state, d),
      blockerTitle: stories[d.blockerId]?.title ?? d.blockerId,
      blockerSprint: locationLabel(state, storyLocation(state, d.blockerId)),
      blockedTitle: stories[d.blockedId]?.title ?? d.blockedId,
      blockedSprint: locationLabel(state, storyLocation(state, d.blockedId)),
    }));

  return { header, sprints: sprintBlocks, backlog: state.backlog.map(storyRow), overCommitment, warnings };
}

// --- per-renderer escaping -------------------------------------------------

/** Markdown: escape the metacharacters that break a table cell (pipe) or inject
 * formatting (asterisk, underscore, backtick); backslash first so it cannot eat
 * a following escape. */
const mdEscape = (/** @type {unknown} */ v) => String(v).replace(/[\\`*_|]/g, (c) => "\\" + c);

/** HTML: entity-encode the ampersand (first), angle brackets, and double-quote
 * so user text can never be read as markup. */
const htmlEscape = (/** @type {unknown} */ v) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** CSV: RFC-4180 — wrap a field in double quotes and double any inner quote when
 * it contains a comma, a quote, or a newline. */
const csvField = (/** @type {unknown} */ v) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// --- renderers (pure strings over the model) -------------------------------

/**
 * Markdown summary: header, a section per sprint (stories as a TABLE of title
 * and points — summary omitted, R6), the over-commitment section, the
 * dependency-warnings section. Each empty section says so explicitly (R4/R5).
 * @param {ReturnType<typeof reportModel>} model
 * @returns {string}
 */
export function toMarkdown(model) {
  const { header, sprints, overCommitment, warnings } = model;
  const out = [];
  out.push(`# ${header.title ?? "Sprint Plan"}`, "");
  out.push(
    `${header.startDate} – ${header.endDate} · ${header.sprintCount} sprints · ` +
      `${header.storyCount} stories · ${header.totalPlacedPoints}/${header.totalCapacity} pts`,
    "",
  );

  for (const sp of sprints) {
    out.push(`## ${sp.name} (${sp.startDate} – ${sp.endDate})${sp.isPartial ? " — partial" : ""}`);
    out.push(`Capacity ${sp.capacity} · placed ${sp.placed} · ${sp.pillState}`);
    if (sp.stories.length) {
      out.push("", "| Story | Points |", "| --- | ---: |");
      // phase2-build6: a stretch story is marked in the listing; non-stretch rows
      // render exactly as before (no spurious annotation when nothing is marked).
      for (const st of sp.stories) {
        out.push(`| ${mdEscape(st.title)}${st.stretch ? " (stretch)" : ""} | ${st.points} |`);
      }
    }
    out.push("");
  }

  out.push("## Over-commitment");
  if (overCommitment.length) {
    // phase2-build6: the FULL overage stays on record; the stretch split is an
    // annotation (only when some of the overage is marked stretch).
    for (const o of overCommitment) {
      const split = o.stretchPoints > 0 ? `, of which ${o.stretchPoints} pts marked stretch` : "";
      out.push(`- ${mdEscape(o.name)}: ${o.placed}/${o.capacity} pts, over by ${o.overBy}${split}`);
    }
  } else {
    out.push("No sprint is over capacity.");
  }
  out.push("");

  out.push("## Dependency warnings");
  if (warnings.length) {
    for (const w of warnings) {
      out.push(
        `- ${w.label}: ${mdEscape(w.blockedTitle)} (${w.blockedSprint}) needs ` +
          `${mdEscape(w.blockerTitle)} (${w.blockerSprint}) — scheduled too early`,
      );
    }
  } else {
    out.push("No dependency violations.");
  }

  return out.join("\n");
}

/**
 * Self-contained, printable HTML document: inline style only, no external asset
 * so it prints offline (R3/G8). Same sections as the markdown; all user text is
 * entity-escaped. Empty sections say so explicitly.
 * @param {ReturnType<typeof reportModel>} model
 * @returns {string}
 */
export function toHtml(model) {
  const { header, sprints, overCommitment, warnings } = model;
  const h = htmlEscape;
  const title = h(header.title ?? "Sprint Plan");

  const sections = sprints
    .map((sp) => {
      const body = sp.stories
        .map((st) => `<tr><td>${h(st.title)}${st.stretch ? " (stretch)" : ""}</td><td class="num">${st.points}</td></tr>`)
        .join("");
      const table = sp.stories.length
        ? `<table><thead><tr><th>Story</th><th class="num">Points</th></tr></thead><tbody>${body}</tbody></table>`
        : "";
      return (
        `<section><h2>${h(sp.name)} <span class="dates">${sp.startDate} – ${sp.endDate}` +
        `${sp.isPartial ? " · partial" : ""}</span></h2>` +
        `<p class="cap ${sp.pillState}">Capacity ${sp.capacity} · placed ${sp.placed} · ${sp.pillState}</p>` +
        `${table}</section>`
      );
    })
    .join("\n");

  const over = overCommitment.length
    ? `<ul>${overCommitment
        .map((o) => {
          const split = o.stretchPoints > 0 ? `, of which ${o.stretchPoints} pts marked stretch` : "";
          return `<li>${h(o.name)}: ${o.placed}/${o.capacity} pts, over by ${o.overBy}${split}</li>`;
        })
        .join("")}</ul>`
    : `<p>No sprint is over capacity.</p>`;

  const warn = warnings.length
    ? `<ul>${warnings
        .map(
          (w) =>
            `<li>${w.label}: ${h(w.blockedTitle)} (${h(w.blockedSprint)}) needs ` +
            `${h(w.blockerTitle)} (${h(w.blockerSprint)})</li>`,
        )
        .join("")}</ul>`
    : `<p>No dependency violations.</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body { font: 14px/1.5 system-ui, -apple-system, sans-serif; max-width: 60rem; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { margin-bottom: .25rem; }
  h2 { margin-top: 1.5rem; border-bottom: 1px solid #ddd; padding-bottom: .2rem; }
  .meta, .dates { color: #666; font-weight: normal; font-size: .85em; }
  table { border-collapse: collapse; width: 100%; margin: .5rem 0 1rem; }
  th, td { border: 1px solid #ccc; padding: .3rem .6rem; text-align: left; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .cap { font-size: .9em; color: #555; }
  .cap.amber { color: #9a6b00; }
  .cap.red { color: #b00020; }
  ul { padding-left: 1.2rem; }
  @media print { body { margin: 0; max-width: none; } }
</style></head>
<body>
<h1>${title}</h1>
<p class="meta">${header.startDate} – ${header.endDate} · ${header.sprintCount} sprints · ${header.storyCount} stories · ${header.totalPlacedPoints}/${header.totalCapacity} pts</p>
${sections}
<h2>Over-commitment</h2>
${over}
<h2>Dependency warnings</h2>
${warn}
</body></html>`;
}

/**
 * Flat CSV, one row per story (every placed story AND every backlog story so
 * nothing the facilitator entered is silently dropped), a header row, the
 * summary as its own column (R6), RFC-4180 escaped. Backlog rows carry a
 * "Backlog" sprint cell and blank capacity/status.
 * @param {ReturnType<typeof reportModel>} model
 * @returns {string}
 */
export function toCsv(model) {
  const { sprints, backlog } = model;
  /** @type {Array<Array<string | number>>} */
  const rows = [
    ["epic", "story", "summary", "points", "sprint", "sprint capacity", "sprint status", "dependency", "stretch"],
  ];
  for (const sp of sprints) {
    for (const st of sp.stories) {
      rows.push([
        st.epicTitle ?? "",
        st.title,
        st.summary,
        st.points,
        sp.name,
        sp.capacity,
        sp.pillState,
        st.inViolation ? "yes" : "",
        st.stretch ? "yes" : "", // phase2-build6: per-story stretch truth
      ]);
    }
  }
  // Backlog rows are blank in the stretch column: stretch is a placed-only report
  // concept even though the flag persists in data if a story is moved back (R4/R6).
  for (const st of backlog) {
    rows.push([st.epicTitle ?? "", st.title, st.summary, st.points, "Backlog", "", "", st.inViolation ? "yes" : "", ""]);
  }
  return rows.map((r) => r.map(csvField).join(",")).join("\n");
}
