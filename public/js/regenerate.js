// @ts-check
/**
 * Pure G3 regeneration: recompute sprint containers from new settings without
 * ever destroying data. Sprints keep identity by index; stories in removed
 * sprints return to the TOP of the backlog; nothing is deleted.
 */

import { generateSprints } from "./plan-maths.js";

/**
 * @typedef {import("./plan-maths.js").Sprint & { placedStoryIds: string[] }} PlacedSprint
 */

/**
 * @param {{ settings: import("./plan-maths.js").PlanSettings, sprints: PlacedSprint[], backlog: string[] }} prevState
 * @param {import("./plan-maths.js").PlanSettings} nextSettings
 * @returns {{ sprints: PlacedSprint[], backlog: string[], returnedStoryIds: string[] }}
 */
export function regenerate(prevState, nextSettings) {
  const newSprints = generateSprints(nextSettings);

  // Surviving sprints carry their placements over by index; new sprints (plan
  // growth) start empty.
  /** @type {PlacedSprint[]} */
  const sprints = newSprints.map((sprint) => ({
    ...sprint,
    placedStoryIds: prevState.sprints[sprint.index]?.placedStoryIds ?? [],
  }));

  // Sprints beyond the new count are removed; their stories return to the top
  // of the backlog in sprint order. Nothing is deleted.
  const returnedStoryIds = prevState.sprints
    .slice(newSprints.length)
    .flatMap((s) => s.placedStoryIds);

  const backlog = [...returnedStoryIds, ...prevState.backlog];

  return { sprints, backlog, returnedStoryIds };
}
