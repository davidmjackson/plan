// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../public/js/store.js";
import { ActionTypes, moveStory } from "../public/js/actions.js";
import { sprintCapacity } from "../public/js/plan-maths.js";
import { reportModel, toMarkdown, toHtml, toCsv } from "../public/js/report.js";

const A = ActionTypes;
const epic = (id, title) => ({ type: A.ADD_EPIC, payload: { id, title } });
const story = (id, title, points, epicId = null, summary = "") => ({
  type: A.ADD_STORY,
  payload: { id, title, summary, points, epicId },
});
const place = (storyId, index) =>
  moveStory({ storyId, target: { kind: "sprint", index }, beforeId: null });
const link = (id, blockerId, blockedId) => ({
  type: A.LINK_DEP,
  payload: { id, blockerId, blockedId },
});

// A title carrying every format-hostile character, and a multiline summary.
const HOSTILE_TITLE = 'A|B *C* `D` <E> & "F", G';
const HOSTILE_SUMMARY = 'sum, line1\nline2 "q"';

/**
 * Real plan state for the report: 7 sprints (last partial, cap 12), full cap 18.
 * - sprint 0: Login(8, E1) + Signup(13, E1) = 21  -> OVER by 3
 * - sprint 1: Logout(5, no epic) = 5            -> neutral
 * - sprint 6 (partial): the hostile-title story (3, E1) = 3
 * - backlog: Research(2)
 * deps:
 * - D1 blocker Logout(s1) blocked Login(s0)  -> VIOLATION (blocked earlier)
 * - D2 blocker Login(s0)  blocked Hostile(s6) -> correct order, not a violation
 * - D3 blocker Signup(s0) blocked Research(backlog) -> backlog-touching, neutral
 */
function fixture() {
  let s = createInitialState("2026-07-06");
  s = reduce(s, { type: A.SET_PLAN_TITLE, payload: "Q3 Roadmap" });
  s = reduce(s, epic("E1", "Backend"));
  s = reduce(s, story("s1", "Login", 8, "E1"));
  s = reduce(s, story("s2", "Signup", 13, "E1"));
  s = reduce(s, story("s3", "Logout", 5, null));
  s = reduce(s, story("s4", HOSTILE_TITLE, 3, "E1", HOSTILE_SUMMARY));
  s = reduce(s, story("s5", "Research", 2, null));
  s = reduce(s, place("s1", 0));
  s = reduce(s, place("s2", 0));
  s = reduce(s, place("s3", 1));
  s = reduce(s, place("s4", 6)); // the partial final sprint
  // s5 stays in the backlog
  s = reduce(s, link("d1", "s3", "s1")); // violation
  s = reduce(s, link("d2", "s1", "s4")); // correct order
  s = reduce(s, link("d3", "s2", "s5")); // backlog-touching
  return s;
}

// --- Case 1: HEADER CARRIES TITLE AND TOTALS -------------------------------

test("reportModel header carries title, totals, dates (matching planSummary)", () => {
  const m = reportModel(fixture());
  assert.equal(m.header.title, "Q3 Roadmap");
  assert.equal(m.header.months, 3);
  assert.equal(m.header.sprintCount, 7);
  assert.equal(m.header.storyCount, 5);
  assert.equal(m.header.startDate, "2026-07-06");
  assert.equal(m.header.endDate, "2026-10-06"); // last sprint's endDate
  assert.equal(m.header.totalPlacedPoints, 8 + 13 + 5 + 3); // backlog excluded
  assert.equal(m.header.totalCapacity, 18 * 6 + 12); // six full + one partial
});

test("reportModel header title is null when unset", () => {
  const m = reportModel(createInitialState("2026-07-06"));
  assert.equal(m.header.title, null);
});

// --- Case 2: SPRINT BLOCKS MATCH THE BOARD ---------------------------------

test("reportModel sprint blocks match plan-maths (stories in order, totals, pill, overBy)", () => {
  const s = fixture();
  const m = reportModel(s);
  assert.equal(m.sprints.length, 7);

  const s0 = m.sprints[0];
  assert.equal(s0.name, "Sprint 1");
  assert.deepEqual(s0.stories.map((x) => x.title), ["Login", "Signup"]);
  assert.deepEqual(s0.stories.map((x) => x.points), [8, 13]);
  assert.equal(s0.stories[0].epicTitle, "Backend");
  assert.equal(s0.placed, 21);
  assert.equal(s0.capacity, 18);
  assert.equal(s0.pillState, "red"); // 21 vs 18 -> >10% over
  assert.equal(s0.overBy, 3);

  const s1 = m.sprints[1];
  assert.equal(s1.placed, 5);
  assert.equal(s1.pillState, "neutral");
  assert.equal(s1.overBy, 0);
  assert.equal(s1.stories[0].epicTitle, null); // Logout has no epic
});

// --- Case 3: OVER-COMMITMENT LISTS EXACTLY THE OVER SPRINTS -----------------

test("reportModel overCommitment lists exactly the over sprints", () => {
  const m = reportModel(fixture());
  assert.equal(m.overCommitment.length, 1);
  assert.deepEqual(m.overCommitment[0], {
    name: "Sprint 1",
    placed: 21,
    capacity: 18,
    overBy: 3,
    stretchPoints: 0, // phase2-build6: no story marked stretch in this fixture
  });
});

test("reportModel overCommitment is empty when no sprint is over", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, story("s1", "Tiny", 1, null));
  s = reduce(s, place("s1", 0));
  assert.deepEqual(reportModel(s).overCommitment, []);
});

// --- Case 4: WARNINGS LIST EXACTLY THE VIOLATIONS --------------------------

test("reportModel warnings list exactly the violating pairs, naming endpoints and sprints", () => {
  const m = reportModel(fixture());
  assert.equal(m.warnings.length, 1);
  assert.deepEqual(m.warnings[0], {
    label: "D1",
    blockerTitle: "Logout",
    blockerSprint: "Sprint 2",
    blockedTitle: "Login",
    blockedSprint: "Sprint 1",
  });
});

// --- Case 5: PARTIAL SPRINT IS PRORATED AND LABELLED -----------------------

test("reportModel partial final sprint carries prorated capacity and the partial flag", () => {
  const s = fixture();
  const m = reportModel(s);
  const last = m.sprints[6];
  assert.equal(last.isPartial, true);
  assert.equal(last.capacity, sprintCapacity(s.sprints[6], s.settings)); // prorated
  assert.equal(last.capacity, 12);
  assert.ok(last.capacity < 18, "prorated capacity is below a full sprint");
});

test("renderers label the partial sprint as partial", () => {
  const m = reportModel(fixture());
  assert.match(toMarkdown(m), /partial/i);
  assert.match(toHtml(m), /partial/i);
});

// --- Case 6: MARKDOWN sections + escaping ----------------------------------

test("toMarkdown renders all four sections", () => {
  const md = toMarkdown(reportModel(fixture()));
  assert.match(md, /Q3 Roadmap/);
  assert.match(md, /Sprint 1/);
  assert.match(md, /over-commitment/i);
  assert.match(md, /dependency warnings/i);
});

test("toMarkdown escapes table-breaking and formatting metacharacters in a title", () => {
  const md = toMarkdown(reportModel(fixture()));
  assert.ok(md.includes("\\|"), "pipe escaped so it cannot break the table cell");
  assert.ok(md.includes("\\*"), "asterisk escaped so it cannot inject emphasis");
  assert.ok(md.includes("\\`"), "backtick escaped so it cannot inject code");
  // the raw hostile title must never appear unescaped
  assert.ok(!md.includes(HOSTILE_TITLE), "raw title with live pipe never emitted");
});

test("toMarkdown says so explicitly when a section is empty", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, story("s1", "Tiny", 1, null));
  s = reduce(s, place("s1", 0));
  const md = toMarkdown(reportModel(s));
  assert.match(md, /no (sprint|over)/i); // over-commitment honest-when-empty
  assert.match(md, /no (dependency|violation|warning)/i);
});

// --- Case 7: HTML self-contained + entity escaping -------------------------

test("toHtml is a self-contained document with its own style and no external asset", () => {
  const html = toHtml(reportModel(fixture()));
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<style/i);
  assert.ok(!/<link|src=|href=http/i.test(html), "no external stylesheet/script/font");
});

test("toHtml entity-encodes the angle brackets, ampersand and double-quote in a title", () => {
  const html = toHtml(reportModel(fixture()));
  assert.ok(html.includes("&lt;E&gt;"), "<E> emitted as entities");
  assert.ok(html.includes("&amp;"), "ampersand emitted as entity");
  assert.ok(html.includes("&quot;"), "double-quote emitted as entity");
  assert.ok(!html.includes("<E>"), "user angle brackets never emitted as raw markup");
});

// --- Case 8: CSV flat, one row per story, RFC-4180 -------------------------

test("toCsv is one row per story (placed + backlog) with a header row and the summary column", () => {
  const csv = toCsv(reportModel(fixture()));
  const firstLine = csv.split("\n")[0];
  assert.match(firstLine, /epic/i);
  assert.match(firstLine, /story/i);
  assert.match(firstLine, /summary/i);
  assert.match(firstLine, /points/i);
  assert.match(firstLine, /sprint/i);
  // the backlog story is a row (sprint cell = Backlog) — nothing silently dropped
  assert.match(csv, /Research/);
  assert.match(csv, /Backlog/);
});

test("toCsv RFC-4180 quotes a comma/quote/newline field; the embedded newline does not split the row", () => {
  const csv = toCsv(reportModel(fixture()));
  // title: inner "F" becomes ""F"", whole field wrapped because of the comma
  assert.ok(csv.includes('"A|B *C* `D` <E> & ""F"", G"'), "title field RFC-4180 quoted");
  // summary: comma + quote + NEWLINE, wrapped, inner quotes doubled, newline kept inside
  assert.ok(csv.includes('"sum, line1\nline2 ""q"""'), "multiline summary field quoted intact");
});

// --- phase2-build6: the stretch dimension (R6) -----------------------------
// Mark Signup (s2, 13 pts, placed in the over sprint 0) a stretch goal.
function stretchFixture() {
  return reduce(fixture(), { type: A.SET_STORY_STRETCH, payload: { id: "s2", stretch: true } });
}

test("reportModel: storyRow.stretch reflects the story; overCommitment carries stretchPoints, overBy stays full", () => {
  const m = reportModel(stretchFixture());
  const s0 = m.sprints[0];
  const signup = s0.stories.find((x) => x.title === "Signup");
  const login = s0.stories.find((x) => x.title === "Login");
  assert.equal(signup.stretch, true);
  assert.equal(login.stretch, false); // absent reads false
  // the over-commitment entry: full overage, annotated with the stretch points
  assert.equal(m.overCommitment[0].overBy, 3, "overBy stays the FULL overage");
  assert.equal(m.overCommitment[0].stretchPoints, 13, "stretchPoints = placed stretch points");
});

test("reportModel: with no stretch, every storyRow.stretch is false and stretchPoints is 0", () => {
  const m = reportModel(fixture());
  for (const sp of m.sprints) for (const st of sp.stories) assert.equal(st.stretch, false);
  assert.equal(m.overCommitment[0].stretchPoints, 0);
});

test("toCsv: a stretch column — placed stretch 'yes', non-stretch blank, backlog blank", () => {
  const csv = toCsv(reportModel(stretchFixture()));
  const lines = csv.split("\n");
  assert.match(lines[0], /stretch/i, "header has a stretch column");
  const cols = lines[0].split(",");
  const idx = cols.findIndex((c) => /stretch/i.test(c));
  const row = (title) => lines.find((l) => l.includes(title)).split(",");
  assert.equal(row("Signup")[idx], "yes", "placed stretch story reads yes");
  assert.equal(row("Login")[idx], "", "placed non-stretch story is blank");
  assert.equal(row("Research")[idx], "", "a backlog row is blank in the stretch column");
});

test("toMarkdown/toHtml: an over sprint shows the full overage AND the stretch split; stretch rows are marked", () => {
  const m = reportModel(stretchFixture());
  const md = toMarkdown(m);
  assert.match(md, /over by 3/, "the full overage is on record");
  assert.match(md, /13 pts marked stretch/i, "the stretch split is annotated");
  assert.match(md, /Signup.*stretch/i, "the stretch story is marked in the per-sprint listing");

  const html = toHtml(m);
  assert.match(html, /over by 3/);
  assert.match(html, /13 pts marked stretch/i);
});

test("toMarkdown: a plan with no stretch reads exactly as today (no spurious stretch annotation)", () => {
  const md = toMarkdown(reportModel(fixture()));
  assert.ok(!/stretch/i.test(md), "no stretch wording anywhere when nothing is marked");
});

// --- Case 10: NO MUTATION AT THE PURE LAYER (R2 at its cheapest) ------------

function deepFreeze(obj) {
  if (obj && typeof obj === "object") {
    Object.values(obj).forEach(deepFreeze);
    Object.freeze(obj);
  }
  return obj;
}

test("the model and all three renderers mutate nothing (deep-frozen state survives)", () => {
  const before = fixture();
  const clone = structuredClone(before);
  deepFreeze(before);
  const m = reportModel(before); // throws if it writes a frozen field
  toMarkdown(m);
  toHtml(m);
  toCsv(m);
  assert.deepEqual(before, clone, "state byte-identical after model + all renderers");
});
