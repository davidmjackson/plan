// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../public/js/store.js";
import {
  ActionTypes,
  addEpic,
  addStory,
  editStory,
  deleteStory,
  deleteEpic,
} from "../public/js/actions.js";
import { backlogGroups, epicSummary } from "../public/js/backlog-selectors.js";

const A = ActionTypes;
const epic = (id, title) => ({ type: A.ADD_EPIC, payload: { id, title } });
const story = (id, epicId, points, extra = {}) => ({
  type: A.ADD_STORY,
  payload: { id, title: id.toUpperCase(), summary: "", points, epicId, ...extra },
});

// --- Case 1: colour rotation -----------------------------------------------

test("ADD_EPIC assigns colourKeys by rotation; the 9th wraps to plum", () => {
  let s = createInitialState("2026-07-06");
  const keys = [];
  for (let i = 0; i < 9; i++) {
    s = reduce(s, epic(`e${i}`, `Epic ${i}`));
    keys.push(s.epics[`e${i}`].colourKey);
  }
  assert.deepEqual(keys, [
    "plum", "violet", "indigo", "teal", "cyan", "green", "moss", "magenta", "plum",
  ]);
});

// --- Case 2: ADD_STORY under an epic ---------------------------------------

test("ADD_STORY adds to the map, appends to the END of backlog, groups under its epic", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("top", null, 2)); // a pre-existing backlog story
  s = reduce(s, story("sNew", "E1", 5));

  assert.equal(Object.keys(s.stories).length, 2);
  assert.deepEqual(s.backlog, ["top", "sNew"]); // appended to the end, not the top
  const e1 = backlogGroups(s).find((g) => g.epic?.id === "E1");
  assert.deepEqual(e1.stories.map((x) => x.id), ["sNew"]);
  assert.deepEqual(epicSummary(s, "E1"), { storyCount: 1, unplacedPoints: 5 });
});

// --- Case 3: ADD_STORY with no epic ----------------------------------------

test("ADD_STORY with epicId null lands in the No-epic group", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, story("loose", null, 3));
  const groups = backlogGroups(s);
  assert.equal(groups.at(-1).epic, null);
  assert.deepEqual(groups.at(-1).stories.map((x) => x.id), ["loose"]);
});

// --- Case 4: EDIT_STORY moves epic, not position ---------------------------

test("EDIT_STORY E1->E2 regroups the story but leaves its backlog position and siblings", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, epic("E2", "Two"));
  s = reduce(s, story("a", "E1", 1));
  s = reduce(s, story("b", "E1", 1));
  s = reduce(s, story("c", "E2", 1));
  s = reduce(s, editStory({ id: "b", title: "B", summary: "", points: 1, epicId: "E2" }));

  assert.deepEqual(s.backlog, ["a", "b", "c"]); // b's index unchanged
  assert.equal(s.stories.b.epicId, "E2");
  const e2 = backlogGroups(s).find((g) => g.epic?.id === "E2");
  assert.deepEqual(e2.stories.map((x) => x.id), ["b", "c"]); // backlog order within group
  assert.equal(s.stories.a.epicId, "E1"); // sibling untouched
});

// --- Case 5: DELETE_STORY atomicity ----------------------------------------

test("DELETE_STORY removes from the map and its holding array, touching no sibling", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, story("a", null, 1));
  s = reduce(s, story("b", null, 1));
  s = reduce(s, story("c", null, 1));
  s = reduce(s, deleteStory({ id: "b" }));

  assert.equal("b" in s.stories, false);
  assert.equal(Object.keys(s.stories).length, 2);
  assert.deepEqual(s.backlog, ["a", "c"]); // a keeps position, c shifts up
});

test("DELETE_STORY also removes a placed story from its sprint, atomically", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, story("d", null, 1));
  // place d in sprint 0 (simulating a later drag); remove from backlog as a move would
  s = { ...s, sprints: s.sprints.map((sp, i) => (i === 0 ? { ...sp, placedStoryIds: ["d"] } : sp)), backlog: [] };
  s = reduce(s, deleteStory({ id: "d" }));

  assert.equal("d" in s.stories, false);
  assert.deepEqual(s.sprints[0].placedStoryIds, []);
});

// --- Case 6: DELETE_EPIC reparent ------------------------------------------

test("DELETE_EPIC reparent: epic gone, children survive as No-epic, zero stories deleted", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("x", "E1", 1));
  s = reduce(s, story("y", "E1", 1));
  s = reduce(s, story("z", "E1", 1));
  s = reduce(s, deleteEpic({ id: "E1", mode: "reparent" }));

  assert.equal("E1" in s.epics, false);
  assert.equal(Object.keys(s.stories).length, 3); // none deleted
  assert.deepEqual(["x", "y", "z"].map((id) => s.stories[id].epicId), [null, null, null]);
  const groups = backlogGroups(s);
  assert.deepEqual(groups.at(-1).stories.map((g) => g.id), ["x", "y", "z"]);
});

// --- Case 7: DELETE_EPIC delete --------------------------------------------

test("DELETE_EPIC delete: exactly the children vanish from map and all arrays; others untouched", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, epic("E2", "Two"));
  s = reduce(s, story("x", "E1", 1));
  s = reduce(s, story("y", "E1", 1));
  s = reduce(s, story("z", "E1", 1));
  s = reduce(s, story("w", "E2", 1));
  // place z in a sprint to prove array removal isn't backlog-only
  s = { ...s, sprints: s.sprints.map((sp, i) => (i === 0 ? { ...sp, placedStoryIds: ["z"] } : sp)), backlog: ["x", "y", "w"] };
  s = reduce(s, deleteEpic({ id: "E1", mode: "delete" }));

  assert.equal("E1" in s.epics, false);
  assert.equal("E2" in s.epics, true);
  assert.deepEqual(Object.keys(s.stories).sort(), ["w"]);
  assert.deepEqual(s.backlog, ["w"]);
  assert.deepEqual(s.sprints[0].placedStoryIds, []);
});

// --- Case 9: regeneration still conserves under the new schema -------------

test("a duration-shrink settings change deletes no card and returns placed stories to the backlog top", () => {
  let s = createInitialState("2026-07-06"); // 7 sprints
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("p1", "E1", 5));
  s = reduce(s, story("b1", "E1", 3));
  // place p1 in sprint 6 (removed when the plan shrinks to 1 month / 3 sprints)
  s = { ...s, sprints: s.sprints.map((sp, i) => (i === 6 ? { ...sp, placedStoryIds: ["p1"] } : sp)), backlog: ["b1"] };

  s = reduce(s, { type: A.SET_DURATION_MONTHS, payload: 1 });

  assert.equal(s.sprints.length, 3);
  assert.equal(Object.keys(s.stories).length, 2); // nothing deleted
  assert.equal("E1" in s.epics, true); // epic intact
  assert.deepEqual(s.backlog, ["p1", "b1"]); // p1 returned to the TOP
});

// --- Action creators mint serializable, prefixed ids -----------------------

test("addEpic / addStory creators mint prefixed ids and surface them", () => {
  const e = addEpic({ title: "X" });
  const st = addStory({ title: "Y", summary: "", points: 3, epicId: null });
  assert.equal(e.type, A.ADD_EPIC);
  assert.match(e.payload.id, /^epic_[a-z0-9]+$/);
  assert.match(st.payload.id, /^story_[a-z0-9]+$/);
});
