// @ts-check
/**
 * The single store. State is plain data; every change goes through `reduce`, a
 * pure function over (state, action). `createStore` adds subscribe/notify and
 * is the only stateful piece. This is the multiplayer-insurance pattern: a sync
 * layer is additive (intercept dispatch / replay actions), not a rewrite.
 */

import { ActionTypes } from "./actions.js";
import { generateSprints } from "./plan-maths.js";
import { regenerate } from "./regenerate.js";
import { PALETTE } from "./epic-palette.js";

/**
 * @typedef {import("./regenerate.js").PlacedSprint} PlacedSprint
 *
 * @typedef {{ id: string, title: string, colourKey: string }} Epic
 * @typedef {{ id: string, title: string, summary: string, points: number, epicId: string | null }} Story
 *
 * @typedef {{ id: string, blockerId: string, blockedId: string }} Dep
 * @typedef {Object} PlanState
 * @property {{ title: string | null, schemaVersion: number }} meta
 * @property {import("./plan-maths.js").PlanSettings} settings
 * @property {PlacedSprint[]} sprints
 * @property {string[]} backlog
 * @property {Record<string, Epic>} epics
 * @property {Record<string, Story>} stories
 * @property {Dep[]} deps  directed dependency pairs (Brief 7)
 * @property {string[]} lastReturnedStoryIds  transient: drives the "returned to backlog" toast
 */

const DEFAULT_SETTINGS = Object.freeze({
  durationMonths: 3,
  sprintWeeks: 2,
  velocity: 20,
  bufferPct: 10,
});

/**
 * A fresh default plan anchored at the given start date.
 * @param {string} startDate ISO (caller supplies, e.g. nextMonday(today))
 * @returns {PlanState}
 */
export function createInitialState(startDate) {
  const settings = { startDate, ...DEFAULT_SETTINGS };
  return {
    meta: { title: null, schemaVersion: 2 },
    settings,
    sprints: generateSprints(settings).map((s) => ({ ...s, placedStoryIds: [] })),
    backlog: [],
    epics: {},
    stories: {},
    deps: [],
    lastReturnedStoryIds: [],
  };
}

/**
 * Apply one settings change: regenerate sprints/backlog per G3, record any
 * stories returned to the backlog for the toast.
 * @param {PlanState} state
 * @param {Partial<import("./plan-maths.js").PlanSettings>} patch
 * @returns {PlanState}
 */
function applySettings(state, patch) {
  const settings = { ...state.settings, ...patch };
  const { sprints, backlog, returnedStoryIds } = regenerate(state, settings);
  return { ...state, settings, sprints, backlog, lastReturnedStoryIds: returnedStoryIds };
}

/**
 * Remove a story id from whichever array holds it (backlog or one sprint).
 * Returns new backlog + sprints; does not touch the stories map.
 * @param {PlanState} state
 * @param {string} id
 */
function removeIdFromArrays(state, id) {
  return {
    backlog: state.backlog.filter((sid) => sid !== id),
    sprints: state.sprints.map((sp) =>
      sp.placedStoryIds.includes(id)
        ? { ...sp, placedStoryIds: sp.placedStoryIds.filter((sid) => sid !== id) }
        : sp,
    ),
  };
}

/**
 * Insert `id` into `ids` before `beforeId`; append when beforeId is null or not
 * present. `id` is assumed already absent from `ids` (remove-then-insert).
 * @param {string[]} ids
 * @param {string} id
 * @param {string | null} beforeId
 * @returns {string[]}
 */
function insertBefore(ids, id, beforeId) {
  const at = beforeId == null ? -1 : ids.indexOf(beforeId);
  if (at < 0) return [...ids, id];
  return [...ids.slice(0, at), id, ...ids.slice(at)];
}

/**
 * MOVE_STORY: move one story to a target array at the position before `beforeId`.
 * Remove-then-insert reusing removeIdFromArrays, so the id is conserved: it sits
 * in exactly one array at all times, never duplicated, never lost. A same-array
 * move is a valid reorder. epicId and points are untouched (the stories map is
 * not read or written). Defensive and pure: an unknown story id or an
 * out-of-range sprint index returns state unchanged.
 * @param {PlanState} state
 * @param {{ storyId: string, target: import("./actions.js").MoveTarget, beforeId: string | null }} payload
 * @returns {PlanState}
 */
function moveStory(state, { storyId, target, beforeId }) {
  if (!(storyId in state.stories)) return state;
  if (target.kind === "sprint" && (target.index < 0 || target.index >= state.sprints.length)) {
    return state;
  }

  const { backlog, sprints } = removeIdFromArrays(state, storyId);
  if (target.kind === "backlog") {
    return { ...state, sprints, backlog: insertBefore(backlog, storyId, beforeId), lastReturnedStoryIds: [] };
  }
  const placed = sprints.map((sp, i) =>
    i === target.index ? { ...sp, placedStoryIds: insertBefore(sp.placedStoryIds, storyId, beforeId) } : sp,
  );
  return { ...state, backlog, sprints: placed, lastReturnedStoryIds: [] };
}

/**
 * DELETE_STORY: atomically remove the story from the map and its holding array.
 * @param {PlanState} state
 * @param {string} id
 * @returns {PlanState}
 */
function deleteStory(state, id) {
  const { [id]: _removed, ...stories } = state.stories;
  // R7: prune every pair referencing the removed id in the same step, so no
  // dangling pair id survives (validatePlan would reject the next load).
  const deps = state.deps.filter((d) => d.blockerId !== id && d.blockedId !== id);
  return { ...state, stories, deps, ...removeIdFromArrays(state, id), lastReturnedStoryIds: [] };
}

/**
 * DELETE_EPIC: 'reparent' sets children to epicId null (zero deleted);
 * 'delete' removes children from the map AND every array. Atomic either way.
 * @param {PlanState} state
 * @param {{ id: string, mode: "reparent" | "delete" }} payload
 * @returns {PlanState}
 */
function deleteEpic(state, { id, mode }) {
  const { [id]: _removedEpic, ...epics } = state.epics;

  if (mode === "reparent") {
    /** @type {Record<string, Story>} */
    const stories = {};
    for (const [sid, st] of Object.entries(state.stories)) {
      stories[sid] = st.epicId === id ? { ...st, epicId: null } : st;
    }
    return { ...state, epics, stories, lastReturnedStoryIds: [] };
  }

  // mode === "delete": remove every child story from the map and all arrays.
  const childIds = new Set(
    Object.values(state.stories).filter((st) => st.epicId === id).map((st) => st.id),
  );
  /** @type {Record<string, Story>} */
  const stories = {};
  for (const [sid, st] of Object.entries(state.stories)) {
    if (!childIds.has(sid)) stories[sid] = st;
  }
  const backlog = state.backlog.filter((sid) => !childIds.has(sid));
  const sprints = state.sprints.map((sp) => ({
    ...sp,
    placedStoryIds: sp.placedStoryIds.filter((sid) => !childIds.has(sid)),
  }));
  // R7: prune every pair referencing a removed child, atomically with the delete.
  const deps = state.deps.filter((d) => !childIds.has(d.blockerId) && !childIds.has(d.blockedId));
  return { ...state, epics, stories, backlog, sprints, deps, lastReturnedStoryIds: [] };
}

/**
 * Pure reducer. Total over the known action set; throws on anything else so a
 * typo'd action surfaces immediately rather than silently no-op'ing.
 * @param {PlanState} state
 * @param {{ type: string, payload?: any }} action
 * @returns {PlanState}
 */
export function reduce(state, action) {
  switch (action.type) {
    case ActionTypes.SET_START_DATE:
      return applySettings(state, { startDate: action.payload });
    case ActionTypes.SET_DURATION_MONTHS:
      return applySettings(state, { durationMonths: action.payload });
    case ActionTypes.SET_SPRINT_WEEKS:
      return applySettings(state, { sprintWeeks: action.payload });
    case ActionTypes.SET_VELOCITY:
      return applySettings(state, { velocity: action.payload });
    case ActionTypes.SET_BUFFER_PCT:
      return applySettings(state, { bufferPct: action.payload });
    case ActionTypes.SET_PLAN_TITLE:
      return { ...state, meta: { ...state.meta, title: action.payload }, lastReturnedStoryIds: [] };
    case ActionTypes.NEW_PLAN:
      return createInitialState(action.payload);
    case ActionTypes.LOAD_PLAN:
      return action.payload;

    // --- Brief 2: epics and stories ---------------------------------------
    case ActionTypes.ADD_EPIC: {
      const { id, title } = action.payload;
      const colourKey = PALETTE[Object.keys(state.epics).length % PALETTE.length];
      return {
        ...state,
        epics: { ...state.epics, [id]: { id, title, colourKey } },
        lastReturnedStoryIds: [],
      };
    }
    case ActionTypes.EDIT_EPIC: {
      const { id, ...patch } = action.payload;
      return {
        ...state,
        epics: { ...state.epics, [id]: { ...state.epics[id], ...patch } },
        lastReturnedStoryIds: [],
      };
    }
    case ActionTypes.DELETE_EPIC:
      return deleteEpic(state, action.payload);

    case ActionTypes.ADD_STORY: {
      const { id, title, summary, points, epicId } = action.payload;
      return {
        ...state,
        stories: { ...state.stories, [id]: { id, title, summary, points, epicId } },
        backlog: [...state.backlog, id], // append to the END (top is the G3 return slot)
        lastReturnedStoryIds: [],
      };
    }
    case ActionTypes.EDIT_STORY: {
      const { id, title, summary, points, epicId } = action.payload;
      return {
        ...state,
        stories: { ...state.stories, [id]: { ...state.stories[id], title, summary, points, epicId } },
        lastReturnedStoryIds: [],
      };
    }
    case ActionTypes.DELETE_STORY:
      return deleteStory(state, action.payload.id);

    // --- Brief 3: placement -----------------------------------------------
    case ActionTypes.MOVE_STORY:
      return moveStory(state, action.payload);

    // --- Brief 7: dependencies (append a pair / filter by id) -------------
    case ActionTypes.LINK_DEP:
      return { ...state, deps: [...state.deps, action.payload], lastReturnedStoryIds: [] };
    case ActionTypes.UNLINK_DEP:
      return {
        ...state,
        deps: state.deps.filter((d) => d.id !== action.payload.id),
        lastReturnedStoryIds: [],
      };

    default:
      throw new Error(`unknown action: ${action.type}`);
  }
}

/**
 * @param {PlanState} initialState
 * @returns {{ getState: () => PlanState, dispatch: (action: { type: string, payload?: any }) => void, subscribe: (fn: (s: PlanState) => void) => () => void }}
 */
export function createStore(initialState) {
  let state = initialState;
  /** @type {Set<(s: PlanState) => void>} */
  const subscribers = new Set();

  return {
    getState: () => state,
    dispatch(action) {
      state = reduce(state, action);
      for (const fn of subscribers) fn(state);
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}
