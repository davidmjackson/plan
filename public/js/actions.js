// @ts-check
/**
 * Action vocabulary for the single store. Every state change is a discrete,
 * named action; creators return plain serializable {type, payload} objects so
 * a sync layer (Liveblocks/Yjs/SignalR) can ship or merge them later without a
 * rewrite. View code never mutates state directly — it dispatches these.
 */

import { newId } from "./ids.js";

export const ActionTypes = Object.freeze({
  SET_START_DATE: "SET_START_DATE",
  SET_DURATION_MONTHS: "SET_DURATION_MONTHS",
  SET_SPRINT_WEEKS: "SET_SPRINT_WEEKS",
  SET_VELOCITY: "SET_VELOCITY",
  SET_BUFFER_PCT: "SET_BUFFER_PCT",
  SET_PLAN_TITLE: "SET_PLAN_TITLE",
  NEW_PLAN: "NEW_PLAN",
  LOAD_PLAN: "LOAD_PLAN",
  // Brief 2 — epics and stories
  ADD_EPIC: "ADD_EPIC",
  EDIT_EPIC: "EDIT_EPIC",
  DELETE_EPIC: "DELETE_EPIC",
  ADD_STORY: "ADD_STORY",
  EDIT_STORY: "EDIT_STORY",
  DELETE_STORY: "DELETE_STORY",
  // Brief 3 — drag-and-drop placement
  MOVE_STORY: "MOVE_STORY",
  // Brief 7 — dependencies (one directed pair, created/removed in the card editor)
  LINK_DEP: "LINK_DEP",
  UNLINK_DEP: "UNLINK_DEP",
  // phase2-build6 — mark a placed story a stretch goal (records intent; never
  // discounts capacity). An explicit boolean, so concurrent room edits are LWW-clean.
  SET_STORY_STRETCH: "SET_STORY_STRETCH",
});

/** @param {string} date */
export const setStartDate = (date) => ({ type: ActionTypes.SET_START_DATE, payload: date });
/** @param {number} months */
export const setDurationMonths = (months) => ({ type: ActionTypes.SET_DURATION_MONTHS, payload: months });
/** @param {number} weeks */
export const setSprintWeeks = (weeks) => ({ type: ActionTypes.SET_SPRINT_WEEKS, payload: weeks });
/** @param {number} velocity */
export const setVelocity = (velocity) => ({ type: ActionTypes.SET_VELOCITY, payload: velocity });
/** @param {number} pct */
export const setBufferPct = (pct) => ({ type: ActionTypes.SET_BUFFER_PCT, payload: pct });
/** @param {string} title */
export const setPlanTitle = (title) => ({ type: ActionTypes.SET_PLAN_TITLE, payload: title });
/** @param {string} startDate */
export const newPlan = (startDate) => ({ type: ActionTypes.NEW_PLAN, payload: startDate });
/** @param {object} state */
export const loadPlan = (state) => ({ type: ActionTypes.LOAD_PLAN, payload: state });

// --- Brief 2: epics and stories. Ids are minted here (creator boundary) so
// the reducer stays pure; colourKey is assigned by the reducer (rotation). ---

/** @param {{ title: string }} fields */
export const addEpic = ({ title }) => ({ type: ActionTypes.ADD_EPIC, payload: { id: newId("epic"), title } });
/** @param {{ id: string, title?: string, colourKey?: string }} patch */
export const editEpic = (patch) => ({ type: ActionTypes.EDIT_EPIC, payload: patch });
/** @param {{ id: string, mode: "reparent" | "delete" }} payload */
export const deleteEpic = (payload) => ({ type: ActionTypes.DELETE_EPIC, payload });

/** @param {{ title: string, summary: string, points: number, epicId: string | null }} fields */
export const addStory = (fields) => ({ type: ActionTypes.ADD_STORY, payload: { id: newId("story"), ...fields } });
/** @param {{ id: string, title: string, summary: string, points: number, epicId: string | null }} fields */
export const editStory = (fields) => ({ type: ActionTypes.EDIT_STORY, payload: fields });
/** @param {{ id: string }} payload */
export const deleteStory = (payload) => ({ type: ActionTypes.DELETE_STORY, payload });

// --- Brief 3: placement. A move is remove-then-insert; the id is conserved.
// `target` is the destination array (backlog, or a sprint by index); `beforeId`
// is the story id to insert before, or null to append (dragula's drop sibling).

/** @typedef {{ kind: "backlog" } | { kind: "sprint", index: number }} MoveTarget */
/** @param {{ storyId: string, target: MoveTarget, beforeId: string | null }} payload */
export const moveStory = (payload) => ({ type: ActionTypes.MOVE_STORY, payload });

// --- Brief 7: dependencies. The pair id is minted here (creator boundary); the
// picker is the creation gate and validatePlan the load backstop, so the reducer
// cases stay trivial (append / filter by id). blockerId = prerequisite (do
// first); blockedId = dependent. ---

/** @param {{ blockerId: string, blockedId: string }} fields */
export const linkDep = ({ blockerId, blockedId }) =>
  ({ type: ActionTypes.LINK_DEP, payload: { id: newId("dep"), blockerId, blockedId } });
/** @param {{ id: string }} payload */
export const unlinkDep = (payload) => ({ type: ActionTypes.UNLINK_DEP, payload });

// --- phase2-build6: stretch toggle. A whole-payload { id, stretch } explicit
// boolean (not a flip), so two concurrent room edits resolve last-write-wins. ---

/** @param {{ id: string, stretch: boolean }} payload */
export const setStoryStretch = (payload) => ({ type: ActionTypes.SET_STORY_STRETCH, payload });
