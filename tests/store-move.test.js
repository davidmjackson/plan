// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../public/js/store.js";
import { ActionTypes, moveStory } from "../public/js/actions.js";

const A = ActionTypes;
const epic = (id, title) => ({ type: A.ADD_EPIC, payload: { id, title } });
const story = (id, epicId, points) => ({
  type: A.ADD_STORY,
  payload: { id, title: id.toUpperCase(), summary: "", points, epicId },
});

/** Helper: place a story id into a sprint by index (state surgery, pre-move setup). */
const idsInSprint = (s, i) => s.sprints[i].placedStoryIds;

// --- Case 2: MOVE_STORY backlog -> sprint ----------------------------------

test("MOVE_STORY backlog->sprint: id leaves backlog, lands in the sprint at the head", () => {
  let s = createInitialState("2026-07-06"); // 7 sprints
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("a", "E1", 5));
  s = reduce(s, story("b", "E1", 3));

  s = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 2 }, beforeId: null }));

  assert.equal(s.backlog.includes("a"), false);
  assert.deepEqual(idsInSprint(s, 2), ["a"]);
  assert.equal(Object.keys(s.stories).length, 2); // nothing created or lost
  assert.deepEqual(s.backlog, ["b"]); // b untouched
});

// --- Case 3: MOVE_STORY sprint -> sprint -----------------------------------

test("MOVE_STORY sprint->sprint: id moves between sprints, conserved, epicId intact", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("a", "E1", 8));
  s = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 1 }, beforeId: null }));

  s = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 3 }, beforeId: null }));

  assert.deepEqual(idsInSprint(s, 1), []);
  assert.deepEqual(idsInSprint(s, 3), ["a"]);
  assert.equal(s.stories.a.epicId, "E1");
});

// --- Case 4: MOVE_STORY sprint -> backlog (manual return, no toast) ---------

test("MOVE_STORY sprint->backlog: returns to backlog, fires no toast (lastReturnedStoryIds stays empty)", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("a", "E1", 5));
  s = reduce(s, story("b", "E1", 3));
  s = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 2 }, beforeId: null }));

  s = reduce(s, moveStory({ storyId: "a", target: { kind: "backlog" }, beforeId: "b" }));

  assert.deepEqual(idsInSprint(s, 2), []);
  assert.deepEqual(s.backlog, ["a", "b"]); // landed before b
  assert.deepEqual(s.lastReturnedStoryIds, []); // a manual drag is NOT a system return
});

// --- Case 5: reorder is theatre --------------------------------------------

test("MOVE_STORY same-sprint reorder: order changes, the id set does not", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("a", "E1", 5));
  s = reduce(s, story("b", "E1", 8));
  s = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 0 }, beforeId: null }));
  s = reduce(s, moveStory({ storyId: "b", target: { kind: "sprint", index: 0 }, beforeId: null }));
  assert.deepEqual(idsInSprint(s, 0), ["a", "b"]);

  // move a to the end (before nothing) within the same sprint
  s = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 0 }, beforeId: null }));

  assert.deepEqual(idsInSprint(s, 0), ["b", "a"]); // reordered
});

// --- Case 6: epicId is drag-invariant --------------------------------------

test("epicId survives backlog->sprint->sprint->backlog unchanged", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("a", "E1", 5));

  s = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 0 }, beforeId: null }));
  assert.equal(s.stories.a.epicId, "E1");
  s = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 4 }, beforeId: null }));
  assert.equal(s.stories.a.epicId, "E1");
  s = reduce(s, moveStory({ storyId: "a", target: { kind: "backlog" }, beforeId: null }));
  assert.equal(s.stories.a.epicId, "E1");
});

// --- Case 7: conservation under an arbitrary move sequence -----------------

test("after a sequence of moves, the id multiset equals exactly the keys of stories{}", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  for (const id of ["a", "b", "c", "d"]) s = reduce(s, story(id, "E1", 3));

  const seq = [
    moveStory({ storyId: "a", target: { kind: "sprint", index: 0 }, beforeId: null }),
    moveStory({ storyId: "b", target: { kind: "sprint", index: 0 }, beforeId: "a" }),
    moveStory({ storyId: "c", target: { kind: "sprint", index: 2 }, beforeId: null }),
    moveStory({ storyId: "a", target: { kind: "sprint", index: 2 }, beforeId: "c" }),
    moveStory({ storyId: "b", target: { kind: "backlog" }, beforeId: "d" }),
    moveStory({ storyId: "d", target: { kind: "sprint", index: 0 }, beforeId: null }),
  ];
  for (const action of seq) s = reduce(s, action);

  const placed = s.sprints.flatMap((sp) => sp.placedStoryIds);
  const all = [...s.backlog, ...placed].sort();
  assert.deepEqual(all, ["a", "b", "c", "d"]); // no dup, no loss
  assert.equal(new Set(all).size, all.length); // every id appears exactly once
  assert.deepEqual(Object.keys(s.stories).sort(), ["a", "b", "c", "d"]);
});

// --- Invalid moves: pure, state unchanged ----------------------------------

test("MOVE_STORY of an unknown id returns state unchanged (same reference)", () => {
  let s = createInitialState("2026-07-06");
  s = reduce(s, story("a", null, 3));
  const before = s;
  const after = reduce(s, moveStory({ storyId: "ghost", target: { kind: "sprint", index: 0 }, beforeId: null }));
  assert.equal(after, before);
});

test("MOVE_STORY to an out-of-range sprint index returns state unchanged", () => {
  let s = createInitialState("2026-07-06"); // 7 sprints => valid 0..6
  s = reduce(s, story("a", null, 3));
  const before = s;
  const after = reduce(s, moveStory({ storyId: "a", target: { kind: "sprint", index: 99 }, beforeId: null }));
  assert.equal(after, before);
});

// --- Case 8: regeneration after a real placement conserves -----------------

test("placing into the partial sprint then shrinking the plan returns stories to the backlog top, deletes none", () => {
  let s = createInitialState("2026-07-06"); // 7 sprints
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("p1", "E1", 5));
  s = reduce(s, story("p2", "E1", 8));
  s = reduce(s, story("keep", "E1", 2));
  s = reduce(s, moveStory({ storyId: "p1", target: { kind: "sprint", index: 6 }, beforeId: null }));
  s = reduce(s, moveStory({ storyId: "p2", target: { kind: "sprint", index: 6 }, beforeId: null }));
  s = reduce(s, moveStory({ storyId: "keep", target: { kind: "sprint", index: 0 }, beforeId: null }));

  s = reduce(s, { type: A.SET_DURATION_MONTHS, payload: 1 }); // 3 sprints; sprint 6 removed

  assert.equal(s.sprints.length, 3);
  assert.equal(Object.keys(s.stories).length, 3); // nothing deleted
  assert.deepEqual(s.backlog.slice(0, 2).sort(), ["p1", "p2"]); // both at the top
  assert.deepEqual(idsInSprint(s, 0), ["keep"]); // surviving placement intact
  assert.deepEqual(s.lastReturnedStoryIds.sort(), ["p1", "p2"]); // toast fires
});

// --- Creator mints a serializable action -----------------------------------

test("moveStory creator returns a plain serializable {type, payload}", () => {
  const action = moveStory({ storyId: "a", target: { kind: "sprint", index: 1 }, beforeId: null });
  assert.equal(action.type, A.MOVE_STORY);
  assert.deepEqual(action.payload, { storyId: "a", target: { kind: "sprint", index: 1 }, beforeId: null });
});
