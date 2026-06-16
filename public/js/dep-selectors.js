// @ts-check
/**
 * Pure, DOM-free selectors over the dependency model (Brief 7 slice 1). A
 * dependency is one directed pair { id, blockerId, blockedId } in state.deps:
 * the blocker is the prerequisite (do first), the blocked is the dependent.
 * These drive the card-editor Dependencies rows, the picker, and the shared D
 * badge — and isViolation feeds the editor-row red treatment (slice 1) and,
 * later, the board-side red treatment (slice 2). Selectors read; never write.
 *
 * @typedef {import("./store.js").PlanState} PlanState
 * @typedef {{ id: string, blockerId: string, blockedId: string }} Dep
 * @typedef {{ kind: "sprint", index: number } | { kind: "backlog" }} StoryLocation
 */

/**
 * Where a story currently sits, or null for an unknown id. Pure, never throws.
 * @param {PlanState} state
 * @param {string} storyId
 * @returns {StoryLocation | null}
 */
export function storyLocation(state, storyId) {
  for (let index = 0; index < state.sprints.length; index++) {
    if (state.sprints[index].placedStoryIds.includes(storyId)) return { kind: "sprint", index };
  }
  if (state.backlog.includes(storyId)) return { kind: "backlog" };
  return null;
}

/**
 * A mono-rendered label for a location: the sprint's own name, or "Backlog".
 * @param {PlanState} state
 * @param {StoryLocation | null} location
 * @returns {string | null}
 */
export function locationLabel(state, location) {
  if (!location) return null;
  if (location.kind === "backlog") return "Backlog";
  return state.sprints[location.index]?.name ?? null;
}

/**
 * This story's side of a pair: "blocks" if it is the blocker/prerequisite,
 * "needs" if it is the blocked/dependent, null if it is neither endpoint.
 * @param {Dep} dep
 * @param {string} storyId
 * @returns {"blocks" | "needs" | null}
 */
export function depRole(dep, storyId) {
  if (dep.blockerId === storyId) return "blocks";
  if (dep.blockedId === storyId) return "needs";
  return null;
}

/**
 * The shared badge label, derived from deps order: D1, D2, ... Both endpoints
 * of a pair share it by construction (same pair object, same index).
 * @param {PlanState} state
 * @param {Dep} dep
 * @returns {string}
 */
export function depLabel(state, dep) {
  return "D" + (state.deps.indexOf(dep) + 1);
}

/**
 * True only when BOTH endpoints are scheduled in sprints AND the blocked story
 * sits in a strictly earlier sprint than its blocker — the dependent is planned
 * before the thing it needs (R4). Backlog either side, same sprint, or correct
 * order all return false (G7: a violation evaluates only when both are placed).
 * @param {PlanState} state
 * @param {Dep} dep
 * @returns {boolean}
 */
export function isViolation(state, dep) {
  const blocker = storyLocation(state, dep.blockerId);
  const blocked = storyLocation(state, dep.blockedId);
  if (blocker?.kind !== "sprint" || blocked?.kind !== "sprint") return false;
  return blocked.index < blocker.index;
}

/** Every pair touching a story, in deps order. @param {PlanState} state @param {string} storyId @returns {Dep[]} */
function depsTouching(state, storyId) {
  return state.deps.filter((d) => d.blockerId === storyId || d.blockedId === storyId);
}

/**
 * The card-editor rows for a story: one entry per touching pair, in deps order.
 * @param {PlanState} state
 * @param {string} storyId
 * @returns {Array<{ dep: Dep, label: string, role: "blocks" | "needs" | null,
 *   otherId: string, otherTitle: string, otherLocation: StoryLocation | null, violation: boolean }>}
 */
export function depsForStory(state, storyId) {
  return depsTouching(state, storyId).map((dep) => {
    const otherId = dep.blockerId === storyId ? dep.blockedId : dep.blockerId;
    return {
      dep,
      label: depLabel(state, dep),
      role: depRole(dep, storyId),
      otherId,
      otherTitle: state.stories[otherId]?.title ?? otherId,
      otherLocation: storyLocation(state, otherId),
      violation: isViolation(state, dep),
    };
  });
}

/**
 * The card badges for a story: one { label, violation } per touching pair. This
 * slice renders label only (neutral); violation is carried for slice 2.
 * @param {PlanState} state
 * @param {string} storyId
 * @returns {Array<{ label: string, violation: boolean }>}
 */
export function depBadges(state, storyId) {
  return depsTouching(state, storyId).map((dep) => ({
    label: depLabel(state, dep),
    violation: isViolation(state, dep),
  }));
}

/**
 * The board drawing set (Brief 8 slice 2): one entry per pair with BOTH
 * endpoints placed in sprints. Pairs touching the backlog are excluded (R3/G7).
 * kind is "tether" when both share a sprint (fromIndex === toIndex), else
 * "connector". fromIndex is the blocker's (do-first) sprint index, toIndex the
 * blocked's (dependent) index; the entry names blockerId/blockedId so the view
 * can place the arrowhead at the depended-on (blocker) end (phase2-build2,
 * reversed from Brief 8's dependent-end convention). violation === isViolation.
 * Pure and DOM-free: the view consumes this and only measures pixels.
 * @param {PlanState} state
 * @returns {Array<{ dep: Dep, blockerId: string, blockedId: string,
 *   fromIndex: number, toIndex: number, kind: "tether" | "connector", violation: boolean }>}
 */
export function connectorsToDraw(state) {
  const drawn = [];
  for (const dep of state.deps) {
    const blocker = storyLocation(state, dep.blockerId);
    const blocked = storyLocation(state, dep.blockedId);
    if (blocker?.kind !== "sprint" || blocked?.kind !== "sprint") continue;
    drawn.push({
      dep,
      blockerId: dep.blockerId,
      blockedId: dep.blockedId,
      fromIndex: blocker.index,
      toIndex: blocked.index,
      kind: /** @type {"tether" | "connector"} */ (blocker.index === blocked.index ? "tether" : "connector"),
      violation: isViolation(state, dep),
    });
  }
  return drawn;
}

/**
 * The picker list: every OTHER story not already paired with this one, each as
 * { id, title, location } for grouping by location and exclusion (R3, R4).
 * Backlog stories are pickable.
 * @param {PlanState} state
 * @param {string} storyId
 * @returns {Array<{ id: string, title: string, location: StoryLocation | null }>}
 */
export function pickableDepTargets(state, storyId) {
  const paired = new Set();
  for (const d of depsTouching(state, storyId)) {
    paired.add(d.blockerId === storyId ? d.blockedId : d.blockerId);
  }
  return Object.values(state.stories)
    .filter((st) => st.id !== storyId && !paired.has(st.id))
    .map((st) => ({ id: st.id, title: st.title, location: storyLocation(state, st.id) }));
}
