// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../public/js/store.js";
import { ActionTypes, linkDep, unlinkDep, deleteStory, deleteEpic } from "../public/js/actions.js";
import { depBadges } from "../public/js/dep-selectors.js";
import { validatePlan } from "../public/js/plan-io.js";

const A = ActionTypes;
const epic = (id, title) => ({ type: A.ADD_EPIC, payload: { id, title } });
const story = (id, epicId = null, points = 3) => ({
  type: A.ADD_STORY,
  payload: { id, title: id.toUpperCase(), summary: "", points, epicId },
});

/** A plan with epic E1 owning a,b and an epic-less c. */
function plan() {
  let s = createInitialState("2026-07-06");
  s = reduce(s, epic("E1", "One"));
  s = reduce(s, story("a", "E1"));
  s = reduce(s, story("b", "E1"));
  s = reduce(s, story("c", null));
  return s;
}

// --- linkDep / unlinkDep creators and reducer ------------------------------

test("linkDep mints a prefixed id at the creator edge and carries both ids", () => {
  const action = linkDep({ blockerId: "b", blockedId: "a" });
  assert.equal(action.type, A.LINK_DEP);
  assert.equal(action.payload.blockerId, "b");
  assert.equal(action.payload.blockedId, "a");
  assert.match(action.payload.id, /^dep_/);
});

test("LINK_DEP appends the pair; UNLINK_DEP removes it by id", () => {
  let s = plan();
  const link = linkDep({ blockerId: "b", blockedId: "a" });
  s = reduce(s, link);
  assert.equal(s.deps.length, 1);
  assert.deepEqual(s.deps[0], link.payload);

  s = reduce(s, unlinkDep({ id: link.payload.id }));
  assert.deepEqual(s.deps, []);
});

test("LINK_DEP does not disturb stories, backlog, or sprints", () => {
  const before = plan();
  const after = reduce(before, linkDep({ blockerId: "a", blockedId: "b" }));
  assert.deepEqual(after.stories, before.stories);
  assert.deepEqual(after.backlog, before.backlog);
  assert.deepEqual(after.sprints, before.sprints);
});

// --- Case 13: DELETE PRUNES (the data-loss-critical case) ------------------

test("deleteStory removes every pair referencing it; the surviving card shows no badge", () => {
  let s = plan();
  s = reduce(s, linkDep({ blockerId: "b", blockedId: "a" })); // a needs b
  s = reduce(s, deleteStory({ id: "a" }));
  assert.equal(s.deps.length, 0, "the pair touching a is gone");
  assert.deepEqual(depBadges(s, "b"), [], "b's badge for that pair disappears");
  assert.equal(validatePlan(s).ok, true, "no dangling pair id remains");
});

test("deleteStory prunes only pairs touching the deleted id, leaving others intact", () => {
  let s = plan();
  s = reduce(s, story("d", null)); // a fourth story
  s = reduce(s, linkDep({ blockerId: "a", blockedId: "b" })); // touches a
  s = reduce(s, linkDep({ blockerId: "c", blockedId: "d" })); // does not touch a
  s = reduce(s, deleteStory({ id: "a" }));
  assert.equal(s.deps.length, 1);
  assert.equal(s.deps[0].blockerId, "c");
  assert.equal(validatePlan(s).ok, true);
});

test("deleteEpic(delete) prunes pairs referencing any removed child story", () => {
  let s = plan(); // E1 owns a,b; c is epic-less
  s = reduce(s, linkDep({ blockerId: "a", blockedId: "c" })); // a (child of E1) needs c
  s = reduce(s, linkDep({ blockerId: "a", blockedId: "b" })); // both children of E1
  s = reduce(s, deleteEpic({ id: "E1", mode: "delete" }));
  assert.equal(s.deps.length, 0, "both pairs referenced a removed child");
  assert.deepEqual(depBadges(s, "c"), [], "c keeps no badge for the pruned pair");
  assert.equal(validatePlan(s).ok, true);
});

test("deleteEpic(reparent) keeps stories and therefore keeps their pairs", () => {
  let s = plan();
  s = reduce(s, linkDep({ blockerId: "a", blockedId: "b" }));
  s = reduce(s, deleteEpic({ id: "E1", mode: "reparent" }));
  assert.equal(s.deps.length, 1, "reparent deletes no story, so the pair survives");
  assert.equal(validatePlan(s).ok, true);
});
