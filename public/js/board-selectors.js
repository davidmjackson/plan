// @ts-check
/**
 * Pure, DOM-free derived view data for the board (sprint side). The pill renders
 * from these selectors only — capacity is never stored, and "placed" is always
 * the SUM OF POINTS of the placed stories, never their count.
 */

/**
 * @typedef {import("./store.js").PlanState} PlanState
 */

/**
 * Sum of the points of the stories whose ids are in `storyIds`. Unknown ids
 * contribute nothing (defensive; the array is the source of truth).
 * @param {string[]} storyIds
 * @param {Record<string, { points: number }>} stories
 * @returns {number}
 */
export function placedPoints(storyIds, stories) {
  return storyIds.reduce((sum, id) => sum + (stories[id]?.points ?? 0), 0);
}

/**
 * Placed points for one sprint — the figure the capacity pill consumes. Returns
 * 0 for an empty or out-of-range sprint (no throw; pure).
 * @param {PlanState} state
 * @param {number} sprintIndex
 * @returns {number}
 */
export function sprintPlacedPoints(state, sprintIndex) {
  const sprint = state.sprints[sprintIndex];
  if (!sprint) return 0;
  return placedPoints(sprint.placedStoryIds, state.stories);
}

/**
 * Derived numbers for the resume card (Brief 6, Screen 3). months is the
 * SETTINGS duration (not the sprint count); sprints is the GENERATED count;
 * stories is ALL stories (backlog + placed); placedPoints is PLACED only
 * (backlog excluded), summed via sprintPlacedPoints so the points authority is
 * never re-implemented. Pure, DOM-free.
 * @param {PlanState} state
 * @returns {{ months: number, sprints: number, stories: number, placedPoints: number }}
 */
export function planSummary(state) {
  let placedPoints = 0;
  for (let i = 0; i < state.sprints.length; i++) placedPoints += sprintPlacedPoints(state, i);
  return {
    months: state.settings.durationMonths,
    sprints: state.sprints.length,
    stories: Object.keys(state.stories).length,
    placedPoints,
  };
}
