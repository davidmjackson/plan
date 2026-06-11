// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, createInitialState, reduce } from "../public/js/store.js";
import {
  ActionTypes,
  setStartDate,
  setDurationMonths,
  setVelocity,
  setPlanTitle,
  newPlan,
  loadPlan,
} from "../public/js/actions.js";

test("createInitialState builds default settings and generated sprints with empty placements", () => {
  const state = createInitialState("2026-07-06");
  assert.deepEqual(state.settings, {
    startDate: "2026-07-06",
    durationMonths: 3,
    sprintWeeks: 2,
    velocity: 20,
    bufferPct: 10,
  });
  assert.equal(state.sprints.length, 7);
  assert.equal(state.meta.title, null);
  assert.deepEqual(state.backlog, []);
  state.sprints.forEach((s) => assert.deepEqual(s.placedStoryIds, []));
});

test("capacity is never stored on a sprint (derived only)", () => {
  const state = createInitialState("2026-07-06");
  assert.equal("capacity" in state.sprints[0], false);
});

test("action creators return plain serializable {type, payload} objects", () => {
  assert.deepEqual(setVelocity(30), { type: ActionTypes.SET_VELOCITY, payload: 30 });
  assert.deepEqual(setPlanTitle("Q3"), { type: ActionTypes.SET_PLAN_TITLE, payload: "Q3" });
});

test("reduce(SET_VELOCITY) updates settings without changing structure", () => {
  const state = createInitialState("2026-07-06");
  const next = reduce(state, setVelocity(30));
  assert.equal(next.settings.velocity, 30);
  assert.equal(next.sprints.length, 7);
  assert.equal(next.sprints[0].startDate, state.sprints[0].startDate);
  assert.deepEqual(next.lastReturnedStoryIds, []);
  assert.notEqual(next, state); // pure: new object
});

test("reduce(SET_START_DATE) re-dates sprints", () => {
  const state = createInitialState("2026-07-06");
  const next = reduce(state, setStartDate("2026-07-13"));
  assert.equal(next.sprints[0].startDate, "2026-07-13");
});

test("reduce(SET_DURATION_MONTHS) shrink returns placed stories to the backlog top", () => {
  const base = createInitialState("2026-07-06");
  // seed a story in a sprint that the shrink will remove (sprint index 6)
  const seeded = {
    ...base,
    sprints: base.sprints.map((s) =>
      s.index === 6 ? { ...s, placedStoryIds: ["s6"] } : s,
    ),
  };
  const next = reduce(seeded, setDurationMonths(1)); // 7 -> 3 sprints
  assert.equal(next.sprints.length, 3);
  assert.deepEqual(next.backlog, ["s6"]);
  assert.deepEqual(next.lastReturnedStoryIds, ["s6"]);
});

test("reduce(SET_PLAN_TITLE) sets the title and leaves sprints untouched", () => {
  const state = createInitialState("2026-07-06");
  const next = reduce(state, setPlanTitle("Q3 delivery"));
  assert.equal(next.meta.title, "Q3 delivery");
  assert.equal(next.sprints, state.sprints); // structure object reused
});

test("reduce(NEW_PLAN) resets to a fresh default plan at the given start date", () => {
  const state = reduce(createInitialState("2026-07-06"), setPlanTitle("X"));
  const next = reduce(state, newPlan("2026-08-03"));
  assert.equal(next.meta.title, null);
  assert.equal(next.settings.startDate, "2026-08-03");
});

test("reduce(LOAD_PLAN) replaces the whole state", () => {
  const state = createInitialState("2026-07-06");
  const loaded = createInitialState("2027-01-04");
  const next = reduce(state, loadPlan(loaded));
  assert.equal(next.settings.startDate, "2027-01-04");
});

test("reduce throws on an unknown action type", () => {
  const state = createInitialState("2026-07-06");
  assert.throws(() => reduce(state, { type: "BOGUS", payload: 1 }), /unknown action/i);
});

test("createStore dispatches through reduce and notifies subscribers", () => {
  const store = createStore(createInitialState("2026-07-06"));
  let seen = null;
  const unsubscribe = store.subscribe((s) => {
    seen = s;
  });
  store.dispatch(setVelocity(30));
  assert.equal(store.getState().settings.velocity, 30);
  assert.equal(seen.settings.velocity, 30);

  unsubscribe();
  store.dispatch(setVelocity(40));
  assert.equal(seen.settings.velocity, 30); // no longer notified
});
