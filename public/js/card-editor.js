// @ts-check
/**
 * Card (story) editor modal — Screen 2 minus the dependencies section (deferred
 * to the dependencies brief). View-only state; commits via ADD_STORY /
 * EDIT_STORY / DELETE_STORY. The dependencies section is intentionally absent.
 */

import { el } from "./dom.js";
import { openModal } from "./modal.js";
import { addStory, editStory, deleteStory, addEpic } from "./actions.js";
import { parsePoints, isNonEmptyTitle } from "./validate.js";

const FIB = [1, 2, 3, 5, 8, 13, 21];

/**
 * @param {ReturnType<import("./store.js").createStore>} store
 * @param {{ storyId?: string, epicId?: string | null }} [opts]
 */
export function openCardEditor(store, opts = {}) {
  const state = store.getState();
  const existing = opts.storyId ? state.stories[opts.storyId] : null;
  const isEdit = Boolean(existing);

  const initial = existing ?? {
    title: "",
    summary: "",
    points: "",
    epicId: opts.epicId ?? null,
  };

  const content = el("div", "modal-body");

  // Title -----------------------------------------------------------------
  const titleField = el("div", "field");
  titleField.append(el("label", "label", "Title"));
  const titleInput = /** @type {HTMLInputElement} */ (el("input", "input"));
  titleInput.type = "text";
  titleInput.value = initial.title;
  titleField.append(titleInput);
  const titleErr = el("p", "field-err", "Title is required.");
  titleErr.hidden = true;
  titleField.append(titleErr);
  content.append(titleField);

  // Epic select + inline "+ New epic" -------------------------------------
  const epicField = el("div", "field");
  epicField.append(el("label", "label", "Epic"));
  const epicRow = el("div", "epic-select-row");
  const epicSelect = /** @type {HTMLSelectElement} */ (el("select", "input"));
  const newEpicBtn = el("button", "btn btn-ghost btn-sm", "+ New epic");
  newEpicBtn.setAttribute("type", "button");
  epicRow.append(epicSelect, newEpicBtn);
  epicField.append(epicRow);

  // Inline new-epic creator (hidden until + New epic)
  const newEpicWrap = el("div", "new-epic-wrap");
  newEpicWrap.hidden = true;
  const newEpicInput = /** @type {HTMLInputElement} */ (el("input", "input"));
  newEpicInput.type = "text";
  newEpicInput.placeholder = "New epic title";
  const newEpicAdd = el("button", "btn btn-pri btn-sm", "Add");
  newEpicAdd.setAttribute("type", "button");
  newEpicWrap.append(newEpicInput, newEpicAdd);
  epicField.append(newEpicWrap);
  content.append(epicField);

  /** @param {string | null} selectedId */
  function refreshEpicOptions(selectedId) {
    epicSelect.replaceChildren();
    const none = /** @type {HTMLOptionElement} */ (el("option", undefined, "No epic"));
    none.value = "";
    epicSelect.append(none);
    for (const epic of Object.values(store.getState().epics)) {
      const opt = /** @type {HTMLOptionElement} */ (el("option", undefined, epic.title));
      opt.value = epic.id;
      epicSelect.append(opt);
    }
    epicSelect.value = selectedId ?? "";
  }
  refreshEpicOptions(initial.epicId);

  newEpicBtn.addEventListener("click", () => {
    newEpicWrap.hidden = false;
    newEpicInput.focus();
  });
  newEpicAdd.addEventListener("click", () => {
    const title = newEpicInput.value.trim();
    if (!isNonEmptyTitle(title)) return;
    const action = addEpic({ title }); // id minted here, before dispatch
    store.dispatch(action);
    newEpicInput.value = "";
    newEpicWrap.hidden = true;
    refreshEpicOptions(action.payload.id); // select the new epic
  });

  // Points: Fibonacci chips + free entry ----------------------------------
  const pointsField = el("div", "field");
  pointsField.append(el("label", "label", "Points"));
  const chipRow = el("div", "chip-row");
  const pointsInput = /** @type {HTMLInputElement} */ (el("input", "input points-input mono"));
  pointsInput.type = "number";
  pointsInput.min = "1";
  pointsInput.step = "1";
  pointsInput.value = initial.points === "" ? "" : String(initial.points);

  function syncChips() {
    for (const chip of Array.from(chipRow.children)) {
      const c = /** @type {HTMLElement} */ (chip);
      c.classList.toggle("is-selected", c.dataset.val === pointsInput.value);
    }
  }
  for (const n of FIB) {
    const chip = el("button", "chip mono", String(n));
    chip.setAttribute("type", "button");
    chip.dataset.val = String(n);
    chip.addEventListener("click", () => {
      pointsInput.value = String(n);
      syncChips();
      pointsErr.hidden = true;
    });
    chipRow.append(chip);
  }
  pointsField.append(chipRow, pointsInput);
  const pointsErr = el("p", "field-err", "Points must be a whole number of 1 or more.");
  pointsErr.hidden = true;
  pointsField.append(pointsErr);
  pointsInput.addEventListener("input", syncChips);
  syncChips();
  content.append(pointsField);

  // Summary ---------------------------------------------------------------
  const summaryField = el("div", "field");
  summaryField.append(el("label", "label", "Summary"));
  const summaryInput = /** @type {HTMLTextAreaElement} */ (el("textarea", "input"));
  summaryInput.value = initial.summary;
  summaryField.append(summaryInput);
  content.append(summaryField);

  // Dirty tracking --------------------------------------------------------
  const snapshot = () => JSON.stringify({
    title: titleInput.value,
    epicId: epicSelect.value,
    points: pointsInput.value,
    summary: summaryInput.value,
  });
  const initialSnapshot = snapshot();
  const isDirty = () => snapshot() !== initialSnapshot;

  // Footer ----------------------------------------------------------------
  const footer = el("div", "modal-footer");
  if (isEdit) {
    const del = el("button", "btn btn-danger btn-sm modal-delete", "Delete story");
    del.setAttribute("type", "button");
    del.addEventListener("click", () => confirmDelete(del));
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
    heading: isEdit ? "Edit story" : "New story",
    content,
    footer,
    isDirty,
  });

  cancel.addEventListener("click", () => modal.attemptClose());

  save.addEventListener("click", () => {
    const title = titleInput.value.trim();
    const points = parsePoints(pointsInput.value);
    titleErr.hidden = isNonEmptyTitle(title);
    pointsErr.hidden = points !== null;
    if (!isNonEmptyTitle(title) || points === null) return;

    const epicId = epicSelect.value === "" ? null : epicSelect.value;
    const fields = { title, summary: summaryInput.value.trim(), points, epicId };
    if (isEdit && existing) {
      store.dispatch(editStory({ id: existing.id, ...fields }));
    } else {
      store.dispatch(addStory(fields));
    }
    modal.close();
  });

  /** @param {HTMLElement} delBtn  inline two-step confirm */
  function confirmDelete(delBtn) {
    if (delBtn.dataset.armed === "1") {
      if (existing) store.dispatch(deleteStory({ id: existing.id }));
      modal.close();
      return;
    }
    delBtn.dataset.armed = "1";
    delBtn.textContent = "Confirm delete";
    setTimeout(() => {
      delBtn.dataset.armed = "0";
      delBtn.textContent = "Delete story";
    }, 3000);
  }
}
