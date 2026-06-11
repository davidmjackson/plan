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
 * @typedef {Object} PlanState
 * @property {{ title: string | null, schemaVersion: number }} meta
 * @property {import("./plan-maths.js").PlanSettings} settings
 * @property {PlacedSprint[]} sprints
 * @property {string[]} backlog
 * @property {Record<string, Epic>} epics
 * @property {Record<string, Story>} stories
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
    meta: { title: null, schemaVersion: 1 },
    settings,
    sprints: generateSprints(settings).map((s) => ({ ...s, placedStoryIds: [] })),
    backlog: [],
    epics: {},
    stories: {},
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
 * DELETE_STORY: atomically remove the story from the map and its holding array.
 * @param {PlanState} state
 * @param {string} id
 * @returns {PlanState}
 */
function deleteStory(state, id) {
  const { [id]: _removed, ...stories } = state.stories;
  return { ...state, stories, ...removeIdFromArrays(state, id), lastReturnedStoryIds: [] };
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
  return { ...state, epics, stories, backlog, sprints, lastReturnedStoryIds: [] };
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
