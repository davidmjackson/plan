// @ts-check
/**
 * Action vocabulary for the single store. Every state change is a discrete,
 * named action; creators return plain serializable {type, payload} objects so
 * a sync layer (Liveblocks/Yjs/SignalR) can ship or merge them later without a
 * rewrite. View code never mutates state directly — it dispatches these.
 */

export const ActionTypes = Object.freeze({
  SET_START_DATE: "SET_START_DATE",
  SET_DURATION_MONTHS: "SET_DURATION_MONTHS",
  SET_SPRINT_WEEKS: "SET_SPRINT_WEEKS",
  SET_VELOCITY: "SET_VELOCITY",
  SET_BUFFER_PCT: "SET_BUFFER_PCT",
  SET_PLAN_TITLE: "SET_PLAN_TITLE",
  NEW_PLAN: "NEW_PLAN",
  LOAD_PLAN: "LOAD_PLAN",
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
