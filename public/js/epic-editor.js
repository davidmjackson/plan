// @ts-check
/**
 * Epic editor modal — Screen 2 variant: title + colour-dot picker, no points or
 * dependencies. New epics get their colour by rotation in the reducer, so the
 * picker shows in edit mode only. Deleting an epic with children offers the
 * reparent-or-delete choice (DELETE_EPIC modes) — no orphaned state.
 */

import { el } from "./dom.js";
import { openModal } from "./modal.js";
import { addEpic, editEpic, deleteEpic } from "./actions.js";
import { isNonEmptyTitle } from "./validate.js";
import { PALETTE } from "./epic-palette.js";

/**
 * @param {ReturnType<import("./store.js").createStore>} store
 * @param {string | null} [epicId]
 */
export function openEpicEditor(store, epicId = null) {
  const state = store.getState();
  const existing = epicId ? state.epics[epicId] : null;
  const isEdit = Boolean(existing);

  let colourKey = existing ? existing.colourKey : PALETTE[0];

  const content = el("div", "modal-body");

  // Title
  const titleField = el("div", "field");
  titleField.append(el("label", "label", "Title"));
  const titleInput = /** @type {HTMLInputElement} */ (el("input", "input"));
  titleInput.type = "text";
  titleInput.value = existing ? existing.title : "";
  titleField.append(titleInput);
  const titleErr = el("p", "field-err", "Title is required.");
  titleErr.hidden = true;
  titleField.append(titleErr);
  content.append(titleField);

  // Colour picker (edit only)
  if (isEdit) {
    const colourField = el("div", "field");
    colourField.append(el("label", "label", "Colour"));
    const dots = el("div", "colour-picker");
    for (const key of PALETTE) {
      const dot = el("button", "epic-dot colour-choice");
      dot.setAttribute("type", "button");
      dot.dataset.epicColour = key;
      if (key === colourKey) dot.classList.add("is-selected");
      dot.addEventListener("click", () => {
        colourKey = key;
        for (const c of Array.from(dots.children)) {
          /** @type {HTMLElement} */ (c).classList.toggle(
            "is-selected",
            /** @type {HTMLElement} */ (c).dataset.epicColour === key,
          );
        }
      });
      dots.append(dot);
    }
    colourField.append(dots);
    content.append(colourField);
  }

  // Dirty tracking
  const snapshot = () => JSON.stringify({ title: titleInput.value, colourKey });
  const initialSnapshot = snapshot();
  const isDirty = () => snapshot() !== initialSnapshot;

  // Footer
  const footer = el("div", "modal-footer");
  if (isEdit && existing) {
    const del = el("button", "btn btn-danger btn-sm modal-delete", "Delete epic");
    del.setAttribute("type", "button");
    del.addEventListener("click", () => startDelete(existing.id));
    footer.append(del);
  }
  const right = el("div", "modal-footer-right");
  const cancel = el("button", "btn btn-ghost", "Cancel");
  cancel.setAttribute("type", "button");
  const save = el("button", "btn btn-pri", "Save");
  save.setAttribute("type", "button");
  right.append(cancel, save);
  footer.append(right);

  const modal = openModal({
    heading: isEdit ? "Edit epic" : "New epic",
    content,
    footer,
    isDirty,
  });

  cancel.addEventListener("click", () => modal.attemptClose());

  save.addEventListener("click", () => {
    const title = titleInput.value.trim();
    titleErr.hidden = isNonEmptyTitle(title);
    if (!isNonEmptyTitle(title)) return;
    if (isEdit && existing) {
      store.dispatch(editEpic({ id: existing.id, title, colourKey }));
    } else {
      store.dispatch(addEpic({ title }));
    }
    modal.close();
  });

  /** @param {string} id */
  function startDelete(id) {
    const childCount = Object.values(store.getState().stories).filter((s) => s.epicId === id).length;
    const bar = el("div", "modal-guard");
    if (childCount === 0) {
      bar.append(el("span", "modal-guard-msg", "Delete this epic?"));
      const keep = el("button", "btn btn-ghost btn-sm", "Cancel");
      const go = el("button", "btn btn-danger btn-sm", "Delete");
      keep.addEventListener("click", () => bar.remove());
      go.addEventListener("click", () => {
        store.dispatch(deleteEpic({ id, mode: "reparent" }));
        modal.close();
      });
      bar.append(keep, go);
    } else {
      bar.append(el("span", "modal-guard-msg", `This epic has ${childCount} ${childCount === 1 ? "story" : "stories"}.`));
      const move = el("button", "btn btn-ghost btn-sm", "Move them to No epic");
      const delAll = el("button", "btn btn-danger btn-sm", "Delete stories too");
      move.addEventListener("click", () => {
        store.dispatch(deleteEpic({ id, mode: "reparent" }));
        modal.close();
      });
      delAll.addEventListener("click", () => {
        store.dispatch(deleteEpic({ id, mode: "delete" }));
        modal.close();
      });
      bar.append(move, delAll);
    }
    modal.card.append(bar);
  }
}
