// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { backlogGroups, epicSummary } from "../public/js/backlog-selectors.js";
import { createInitialState } from "../public/js/store.js";

// Fixture: 3 epics (insertion order E1,E2,E3), stories with a mixed backlog
// order, plus one story placed in a sprint (not in backlog) to exercise the
// placed/unplaced distinction.
function fixture() {
  const s = createInitialState("2026-07-06");
  s.epics = {
    E1: { id: "E1", title: "Epic One", colourKey: "plum" },
    E2: { id: "E2", title: "Epic Two", colourKey: "violet" },
    E3: { id: "E3", title: "Epic Three", colourKey: "indigo" },
  };
  s.stories = {
    s1: { id: "s1", title: "S1", summary: "", points: 5, epicId: "E1" },
    s2: { id: "s2", title: "S2", summary: "", points: 3, epicId: "E1" },
    s3: { id: "s3", title: "S3", summary: "", points: 8, epicId: "E2" },
    s4: { id: "s4", title: "S4", summary: "", points: 2, epicId: null },
    s5: { id: "s5", title: "S5", summary: "", points: 13, epicId: "E1" }, // placed
  };
  s.backlog = ["s3", "s1", "s4", "s2"]; // deliberately mixed
  s.sprints[0].placedStoryIds = ["s5"]; // s5 is NOT in the backlog
  return s;
}

test("backlogGroups returns one group per epic in insertion order, then No-epic", () => {
  const groups = backlogGroups(fixture());
  assert.deepEqual(
    groups.map((g) => (g.epic ? g.epic.id : null)),
    ["E1", "E2", "E3", null],
  );
});

test("backlogGroups preserves backlog[] order within a group and excludes placed stories", () => {
  const groups = backlogGroups(fixture());
  const ids = (i) => groups[i].stories.map((s) => s.id);
  assert.deepEqual(ids(0), ["s1", "s2"]); // E1: backlog order, s5 excluded (placed)
  assert.deepEqual(ids(1), ["s3"]); // E2
  assert.deepEqual(ids(2), []); // E3 row still present with no backlog stories
  assert.deepEqual(ids(3), ["s4"]); // No-epic group
});

test("backlogGroups omits the No-epic group when there are no unparented backlog stories", () => {
  const s = fixture();
  s.stories.s4.epicId = "E2"; // reparent the only unparented story
  const groups = backlogGroups(s);
  assert.deepEqual(
    groups.map((g) => (g.epic ? g.epic.id : null)),
    ["E1", "E2", "E3"],
  );
});

test("epicSummary counts all the epic's stories but only sums points of those still in the backlog", () => {
  const s = fixture();
  assert.deepEqual(epicSummary(s, "E1"), { storyCount: 3, unplacedPoints: 8 }); // s1+s2 in backlog; s5 placed
  assert.deepEqual(epicSummary(s, "E2"), { storyCount: 1, unplacedPoints: 8 });
  assert.deepEqual(epicSummary(s, "E3"), { storyCount: 0, unplacedPoints: 0 });
});
