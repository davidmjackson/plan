// @ts-check
/**
 * Card (story) editor modal — Screen 2. View-only state for the story fields
 * (commit via ADD_STORY / EDIT_STORY / DELETE_STORY on Save); the Dependencies
 * section commits LIVE via LINK_DEP / UNLINK_DEP, since a link is a fact about
 * two existing stories, not a pending field edit. Dependencies show only when
 * editing a saved story (a new, unsaved story has no id to link).
 */

import { el } from "./dom.js";
import { openModal } from "./modal.js";
import { addStory, editStory, deleteStory, addEpic, linkDep, unlinkDep } from "./actions.js";
import { parsePoints, isNonEmptyTitle } from "./validate.js";
import { depsForStory, pickableDepTargets, locationLabel, storyLocation } from "./dep-selectors.js";

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

  // A room-created epic isn't in state until the server echoes it (pessimistic
  // store). Record the id to select; syncFromState selects it once it lands.
  // Locally the echo is synchronous, so selection still feels instant (R4).
  /** @type {string | null} */
  let pendingEpicSelect = null;

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
    pendingEpicSelect = action.payload.id; // select it when state confirms (R1)
    store.dispatch(action);
    newEpicInput.value = "";
    newEpicWrap.hidden = true;
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

  // Dependencies (Brief 7) — only for a saved story; commits live ----------
  const deps = isEdit && existing ? buildDependencies(store, existing.id) : null;
  if (deps) content.append(deps.section);

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

  // React to store NOTIFICATIONS, never to the return of dispatch (R1): one
  // handler keeps the epic select and the dependency rows in step under both the
  // synchronous local store and the pessimistic room store. The view cannot tell
  // which it holds. Torn down on modal close (R5) so reopening never stacks subs.
  function syncFromState() {
    const epicArrived = pendingEpicSelect != null && store.getState().epics[pendingEpicSelect];
    refreshEpicOptions(epicArrived ? pendingEpicSelect : epicSelect.value || null);
    if (epicArrived) pendingEpicSelect = null;
    deps?.renderRows();
  }
  const unsubscribe = store.subscribe(syncFromState);

  const modal = openModal({
    heading: isEdit ? "Edit story" : "New story",
    content,
    footer,
    isDirty,
    onClose: unsubscribe,
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

/**
 * The Dependencies section for a saved story (Screen 2, R6). Renders existing
 * links as rows (shared badge, direction, paired title + location, remove), with
 * a violating row in the red treatment annotated with the other side's location.
 * "This blocks..." / "This needs..." open an inline picker grouped by location;
 * selecting dispatches LINK_DEP. The rows re-render from the caller's store
 * subscription (syncFromState), never from a synchronous read after dispatch, so
 * a link created in a room appears once the server echo lands — identical code
 * under the synchronous local store and the pessimistic room store (R1). Returns
 * the section plus renderRows so the caller can drive it on every notification.
 * @param {ReturnType<import("./store.js").createStore>} store
 * @param {string} storyId
 * @returns {{ section: HTMLElement, renderRows: () => void }}
 */
function buildDependencies(store, storyId) {
  const section = el("div", "field deps-section");
  section.append(el("label", "label", "Dependencies"));

  const rows = el("div", "deps-rows");
  const actions = el("div", "deps-actions");
  const blocksBtn = el("button", "btn btn-ghost btn-sm", "This blocks…");
  const needsBtn = el("button", "btn btn-ghost btn-sm", "This needs…");
  blocksBtn.setAttribute("type", "button");
  needsBtn.setAttribute("type", "button");
  actions.append(needsBtn, blocksBtn);

  const picker = el("div", "dep-picker");
  picker.hidden = true;

  section.append(rows, actions, picker);

  /** Re-render the existing-link rows from current state. */
  function renderRows() {
    const state = store.getState();
    const selfLoc = storyLocation(state, storyId);
    rows.replaceChildren();
    const items = depsForStory(state, storyId);
    if (items.length === 0) {
      const empty = el("p", "deps-empty", "No dependencies yet.");
      rows.append(empty);
      return;
    }
    for (const row of items) {
      const r = el("div", "dep-row");
      if (row.violation) r.classList.add("dep-row--violation");
      r.append(el("span", "dep-badge mono", row.label));
      r.append(el("span", "dep-dir", row.role === "needs" ? "needs" : "blocks"));
      r.append(el("span", "dep-other", row.otherTitle));
      let loc = locationLabel(state, row.otherLocation) ?? "";
      if (row.violation && row.otherLocation?.kind === "sprint" && selfLoc?.kind === "sprint") {
        loc += row.otherLocation.index < selfLoc.index ? ", before this" : ", after this";
      }
      r.append(el("span", "dep-loc mono", loc));
      const remove = el("button", "btn btn-ghost btn-sm dep-remove", "✕");
      remove.setAttribute("type", "button");
      remove.setAttribute("aria-label", `Remove dependency ${row.label}`);
      remove.addEventListener("click", () => {
        store.dispatch(unlinkDep({ id: row.dep.id }));
        // No synchronous re-render: the row clears when state confirms (R1).
      });
      r.append(remove);
      rows.append(r);
    }
  }

  /**
   * Open the inline picker in a mode. mode "blocks": the current story is the
   * blocker, the chosen target the blocked. mode "needs": the reverse.
   * @param {"blocks" | "needs"} mode
   */
  function openPicker(mode) {
    const state = store.getState();
    picker.hidden = false;
    picker.replaceChildren();

    const search = /** @type {HTMLInputElement} */ (el("input", "input dep-search"));
    search.type = "text";
    search.placeholder = mode === "blocks" ? "Search a story this blocks…" : "Search a story this needs…";
    picker.append(search);

    const list = el("div", "dep-picker-list");
    picker.append(list);

    const targets = pickableDepTargets(state, storyId);

    function renderList() {
      const q = search.value.trim().toLowerCase();
      const matched = q ? targets.filter((t) => t.title.toLowerCase().includes(q)) : targets;
      list.replaceChildren();
      if (matched.length === 0) {
        list.append(el("p", "deps-empty", "No matching stories."));
        return;
      }
      for (const group of groupByLocation(state, matched)) {
        list.append(el("div", "dep-group-head mono", group.label));
        for (const t of group.items) {
          const opt = el("button", "btn btn-ghost btn-sm dep-option", t.title);
          opt.setAttribute("type", "button");
          opt.addEventListener("click", () => {
            const payload =
              mode === "blocks"
                ? { blockerId: storyId, blockedId: t.id }
                : { blockerId: t.id, blockedId: storyId };
            store.dispatch(linkDep(payload));
            picker.hidden = true; // optimistic: hide the picker (a UI affordance)
            picker.replaceChildren();
            // The new row appears when state confirms the link (R1).
          });
          list.append(opt);
        }
      }
    }

    search.addEventListener("input", renderList);
    renderList();
    search.focus();
  }

  blocksBtn.addEventListener("click", () => openPicker("blocks"));
  needsBtn.addEventListener("click", () => openPicker("needs"));

  renderRows(); // first paint; subsequent updates come from syncFromState (R1)
  return { section, renderRows };
}

/**
 * Group picker targets by location in board order: each sprint that has targets,
 * then Backlog. @param {import("./store.js").PlanState} state
 * @param {Array<{ id: string, title: string, location: any }>} targets
 * @returns {Array<{ label: string, items: Array<{ id: string, title: string }> }>}
 */
function groupByLocation(state, targets) {
  const groups = [];
  state.sprints.forEach((sp, index) => {
    const items = targets.filter((t) => t.location?.kind === "sprint" && t.location.index === index);
    if (items.length) groups.push({ label: sp.name, items });
  });
  const backlog = targets.filter((t) => t.location?.kind === "backlog");
  if (backlog.length) groups.push({ label: "Backlog", items: backlog });
  return groups;
}
