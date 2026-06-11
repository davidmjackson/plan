// @ts-check
/**
 * View layer. Renders store state into the DOM. Reads state, never mutates it
 * (all changes go through dispatch). Composes the tested pure functions from
 * plan-maths / month-rail for every number it shows.
 */

import { sprintCapacity, pillState, adjustedCapacity } from "./plan-maths.js";
import { assignSprintsToMonths } from "./month-rail.js";
import { renderBacklog } from "./backlog.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-07-06" -> "6 Jul"
 * @param {string} iso
 */
function formatDay(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/**
 * @param {string} startDate
 * @param {string} endDate
 */
export function formatDateRange(startDate, endDate) {
  return `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

/**
 * Sync the settings strip controls and the derived (read-only) capacity.
 * @param {import("./store.js").PlanState} state
 */
export function renderSettingsStrip(state) {
  const { settings } = state;
  /** @type {HTMLInputElement} */ (document.getElementById("ss-start")).value = settings.startDate;
  /** @type {HTMLSelectElement} */ (document.getElementById("ss-duration")).value = String(settings.durationMonths);
  /** @type {HTMLSelectElement} */ (document.getElementById("ss-sprint-weeks")).value = String(settings.sprintWeeks);
  /** @type {HTMLInputElement} */ (document.getElementById("ss-velocity")).value = String(settings.velocity);
  /** @type {HTMLInputElement} */ (document.getElementById("ss-buffer")).value = String(settings.bufferPct);
  const cap = document.getElementById("ss-capacity");
  if (cap) cap.textContent = String(adjustedCapacity(settings.velocity, settings.bufferPct));
}

/**
 * @param {import("./store.js").PlanState} state
 */
export function renderTitle(state) {
  const el = document.getElementById("plan-title");
  if (el && el.textContent !== (state.meta.title ?? "")) {
    el.textContent = state.meta.title ?? "";
  }
}

/**
 * Build the board: a single grid where each rail segment row-spans the sprints
 * assigned to its month, so the rail aligns exactly to the stack.
 * @param {import("./store.js").PlanState} state
 */
export function renderBoard(state) {
  const board = document.getElementById("board");
  if (!board) return;
  board.replaceChildren();

  const { sprints, settings } = state;

  // Rail segments (column 1), each spanning its sprints' rows.
  for (const seg of assignSprintsToMonths(sprints)) {
    const first = seg.sprintIndexes[0];
    const last = seg.sprintIndexes[seg.sprintIndexes.length - 1];
    const railEl = document.createElement("div");
    railEl.className = "rail-seg";
    railEl.style.gridRow = `${first + 1} / ${last + 2}`;
    const label = document.createElement("span");
    label.textContent = seg.label;
    railEl.appendChild(label);
    board.appendChild(railEl);
  }

  // Sprint containers (column 2), one per row.
  for (const sprint of sprints) {
    const capacity = sprintCapacity(sprint, settings);
    const placed = sprint.placedStoryIds.length;
    const state2 = pillState(placed, capacity);

    const el = document.createElement("div");
    el.className = `sprint${sprint.isPartial ? " is-partial" : ""}`;
    el.style.gridRow = String(sprint.index + 1);

    const head = document.createElement("div");
    head.className = "sprint-head";

    const name = document.createElement("span");
    name.className = "sprint-name";
    name.textContent = sprint.name;
    head.appendChild(name);

    const dates = document.createElement("span");
    dates.className = "sprint-dates";
    dates.textContent = formatDateRange(sprint.startDate, sprint.endDate);
    head.appendChild(dates);

    if (sprint.isPartial) {
      const tag = document.createElement("span");
      tag.className = "partial-tag";
      tag.textContent = "partial";
      head.appendChild(tag);
    }

    const pill = document.createElement("span");
    pill.className = `cap-pill is-${state2}`;
    pill.textContent = `${placed} / ${capacity}`;
    head.appendChild(pill);

    el.appendChild(head);

    const body = document.createElement("div");
    body.className = "sprint-body";
    body.textContent = "Drop stories here";
    el.appendChild(body);

    board.appendChild(el);
  }
}

/**
 * Full render pass.
 * @param {import("./store.js").PlanState} state
 */
export function render(state) {
  renderSettingsStrip(state);
  renderTitle(state);
  renderBoard(state);
  renderBacklog(state);
}
