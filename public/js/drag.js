// @ts-check
/**
 * Drag-and-drop wiring (Brief 3). dragula owns the GESTURE only; the store owns
 * the state; render owns the DOM. On drop we read the intended move, REVERT
 * dragula's optimistic DOM mutation (drake.cancel(true)), and dispatch MOVE_STORY
 * — the state-driven re-render then puts the card where state says it goes. The
 * view never mutates state.
 *
 * dragula is a vendored global (loaded via <script> before this module), not an
 * ES module, so we read it off window.
 */

import { moveStory } from "./actions.js";
import { NO_EPIC } from "./backlog.js";

/** @type {{ destroy(): void, on(ev: string, fn: Function): any, cancel(revert?: boolean): void } | null} */
let drake = null;

/**
 * True while a drag gesture is in flight and through the trailing synthetic
 * click the browser fires on mouseup — so click-to-edit can ignore that click
 * and a drag never opens the editor.
 */
let dragging = false;

/** @returns {boolean} whether the last click should be swallowed as drag-end */
export function isDragging() {
  return dragging;
}

/**
 * (Re)build the dragula instance over the CURRENT board + backlog containers.
 * render() rebuilds the DOM on every change, so this must run after each render;
 * it destroys the prior drake first to avoid leaking listeners on dead nodes.
 * @param {import("./store.js").createStore extends (...a: any) => infer S ? S : any} store
 */
export function setupDrag(store) {
  const dragula = /** @type {any} */ (window).dragula;
  if (typeof dragula !== "function") return; // vendor script missing — degrade to no-DnD

  if (drake) drake.destroy();

  const containers = Array.from(document.querySelectorAll("[data-drop]"));
  const d = dragula(containers, {
    // Only story cards are draggable (not the "+ Story" button or the empty
    // "Drop stories here" text).
    moves: (/** @type {HTMLElement} */ el) => !!el && el.dataset && el.dataset.story != null,
    // A sprint accepts any card; a backlog group accepts only its own epic's
    // cards, so a drag can never change a story's epicId (editor-only contract).
    accepts: (/** @type {HTMLElement} */ el, /** @type {HTMLElement} */ target) => {
      if (!target || !target.dataset || !target.dataset.drop) return false;
      if (target.dataset.drop === "sprint") return true;
      return el.dataset.epicId === target.dataset.epicId;
    },
  });

  drake = d;

  d.on("drag", () => {
    dragging = true;
  });
  d.on("dragend", () => {
    // Clear AFTER the trailing click has been swallowed (click fires before this
    // timer). dragula's Y() always emits dragend, on drop and on cancel alike.
    setTimeout(() => {
      dragging = false;
    }, 0);
  });

  d.on(
    "drop",
    (
      /** @type {HTMLElement} */ el,
      /** @type {HTMLElement} */ target,
      /** @type {HTMLElement} */ _source,
      /** @type {HTMLElement | null} */ sibling,
    ) => {
      if (!target || !target.dataset) return; // dropped outside any container
      const storyId = el.dataset.story;
      if (!storyId) return;

      // Insert before the sibling card; null (or a non-card sibling like the
      // "+ Story" button) means append to the end of the target array.
      const beforeId = sibling && sibling.dataset && sibling.dataset.story ? sibling.dataset.story : null;

      /** @type {import("./actions.js").MoveTarget | null} */
      let moveTarget = null;
      if (target.dataset.drop === "sprint") {
        moveTarget = { kind: "sprint", index: Number(target.dataset.sprintIndex) };
      } else if (target.dataset.drop === "backlog") {
        moveTarget = { kind: "backlog" };
      }
      if (!moveTarget) return;

      // Revert dragula's optimistic move now (still mid-gesture, so cancel
      // reverts), then let state drive the DOM. Defer the dispatch so this drop
      // event fully unwinds before render() rebuilds and re-creates the drake.
      drake?.cancel(true);
      const action = moveStory({ storyId, target: moveTarget, beforeId });
      queueMicrotask(() => store.dispatch(action));
    },
  );
}
