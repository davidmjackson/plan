// @ts-check
/**
 * Pure, DOM-free derived view data for the backlog panel. The panel renders
 * from these selectors only — no ad-hoc state traversal in the view.
 */

/**
 * @typedef {import("./store.js").PlanState} PlanState
 * @typedef {{ id: string, title: string, summary: string, points: number, epicId: string | null }} Story
 * @typedef {{ id: string, title: string, colourKey: string }} Epic
 * @typedef {{ epic: Epic | null, stories: Story[] }} BacklogGroup
 */

/**
 * Stories grouped by epic for the backlog panel: one group per epic in
 * insertion order (the row shows even with zero backlog stories), then a
 * trailing "No epic" group only when unparented backlog stories exist. Within
 * each group, backlog[] order is preserved. Placed stories are excluded — the
 * panel shows the backlog only.
 * @param {PlanState} state
 * @returns {BacklogGroup[]}
 */
export function backlogGroups(state) {
  const backlogStories = state.backlog
    .map((id) => state.stories[id])
    .filter(Boolean);

  /** @type {BacklogGroup[]} */
  const groups = Object.values(state.epics).map((epic) => ({
    epic: /** @type {Epic} */ (epic),
    stories: backlogStories.filter((s) => s.epicId === /** @type {Epic} */ (epic).id),
  }));

  const noEpic = backlogStories.filter((s) => s.epicId == null);
  if (noEpic.length > 0) groups.push({ epic: null, stories: noEpic });

  return groups;
}

/**
 * @param {PlanState} state
 * @param {string} epicId
 * @returns {{ storyCount: number, unplacedPoints: number }}
 */
export function epicSummary(state, epicId) {
  const inBacklog = new Set(state.backlog);
  let storyCount = 0;
  let unplacedPoints = 0;
  for (const story of Object.values(state.stories)) {
    if (story.epicId !== epicId) continue;
    storyCount += 1;
    if (inBacklog.has(story.id)) unplacedPoints += story.points;
  }
  return { storyCount, unplacedPoints };
}
