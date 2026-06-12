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

  // The No-epic group persists as a drop target while ANY unparented story
  // exists (placed or not), so a placed loose card can be dragged home; it
  // still lists only the unparented stories currently in the backlog.
  const hasUnparented = Object.values(state.stories).some((s) => s.epicId == null);
  if (hasUnparented) {
    groups.push({ epic: null, stories: backlogStories.filter((s) => s.epicId == null) });
  }

  return groups;
}

/**
 * Per-epic tallies for the backlog group row. Both figures count UNPLACED
 * stories only (those still in backlog[]) so the row meta matches the rows
 * visible beneath it — placed stories live in their sprint, not the panel.
 * @param {PlanState} state
 * @param {string} epicId
 * @returns {{ unplacedCount: number, unplacedPoints: number }}
 */
export function epicSummary(state, epicId) {
  let unplacedCount = 0;
  let unplacedPoints = 0;
  for (const id of state.backlog) {
    const story = state.stories[id];
    if (!story || story.epicId !== epicId) continue;
    unplacedCount += 1;
    unplacedPoints += story.points;
  }
  return { unplacedCount, unplacedPoints };
}
