// @ts-check
/**
 * The "Collaborate live" bridge (MP4): create a shared room seeded with the
 * current plan, then surface a share link. Browser glue — the server's
 * seed-from-plan is unit-tested; this dialog is verified in the app.
 *
 * Collaboration requires an account (MP2 gate): an unauthed create returns 401,
 * which we surface as a friendly "sign in via Sprint Suite" toast rather than a
 * crash. The fetch is same-origin (the authed app is served by the room service);
 * the cross-origin production wiring is a slice-5 deploy concern.
 */

import { el } from "./dom.js";
import { openModal } from "./modal.js";
import { buildInviteUrl } from "./room-join.js";

/**
 * @param {{ button: HTMLElement, getPlan: () => any, flash: (msg: string) => void }} deps
 */
export function wireCollaborate({ button, getPlan, flash }) {
  button.addEventListener("click", () => openCreateDialog(getPlan, flash));
}

/** @param {string} name @param {string} value @param {string} labelText @param {boolean} checked */
function radio(name, value, labelText, checked) {
  const wrap = el("label", "collab-mode");
  const input = /** @type {HTMLInputElement} */ (el("input"));
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  wrap.append(input, el("span", undefined, labelText));
  return { wrap, input };
}

/** @param {() => any} getPlan @param {(m: string) => void} flash */
function openCreateDialog(getPlan, flash) {
  const content = el("div", "modal-body");
  content.append(el("p", "field-hint", "Create a live room from this plan. Everyone you share the link with edits the same board in real time."));

  const field = el("div", "field");
  field.append(el("label", "label", "Who can join"));
  const modes = el("div", "collab-modes");
  const open = radio("collab-mode", "open-link", "Anyone with the link", true);
  const company = radio("collab-mode", "company-only", "Signed-in company members only", false);
  modes.append(open.wrap, company.wrap);
  field.append(modes);
  content.append(field);

  const footer = el("div", "modal-footer");
  const right = el("div", "modal-footer-right");
  const cancel = el("button", "btn btn-ghost", "Cancel");
  cancel.setAttribute("type", "button");
  const create = /** @type {HTMLButtonElement} */ (el("button", "btn btn-pri", "Create room"));
  create.setAttribute("type", "button");
  right.append(cancel, create);
  footer.append(right);

  const modal = openModal({ heading: "Start a shared room", content, footer });
  cancel.addEventListener("click", () => modal.close());

  create.addEventListener("click", async () => {
    const mode = open.input.checked ? "open-link" : "company-only";
    create.disabled = true;
    let res;
    try {
      // redirect:"manual" so the real auth-client's 302→hub-login (the unauthed
      // case) surfaces as an opaqueredirect we can detect, rather than fetch
      // following it cross-origin and throwing.
      res = await fetch("/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, plan: getPlan() }),
        redirect: "manual",
      });
    } catch {
      create.disabled = false;
      return flash("Couldn't reach the collaboration service.");
    }
    // Not signed in: the stub returns 401; the real requireAuth 302-redirects
    // (status 0 / opaqueredirect under redirect:"manual"). Both → sign-in prompt.
    if (res.status === 401 || res.status === 0 || res.type === "opaqueredirect") {
      modal.close();
      return flash("Sign in via Sprint Suite to start a shared room.");
    }
    if (!res.ok) { create.disabled = false; return flash("Couldn't create the room."); }
    showShareLink(content, footer, await res.json());
  });
}

/** A read-only link field with the invite URL; returns the input for select-fallback. */
function linkPane(/** @type {HTMLElement} */ content, /** @type {string} */ url, /** @type {string} */ intro) {
  content.replaceChildren();
  content.append(el("p", "field-hint", intro));
  const field = el("div", "field");
  const input = /** @type {HTMLInputElement} */ (el("input", "input mono"));
  input.type = "text";
  input.value = url;
  input.readOnly = true;
  field.append(input);
  content.append(field);
  return input;
}

/** A copy-to-clipboard button for the invite URL (select-fallback if blocked). */
function copyBtn(/** @type {string} */ url, /** @type {HTMLInputElement} */ input) {
  const copy = el("button", "btn btn-ghost", "Copy link");
  copy.setAttribute("type", "button");
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(url); copy.textContent = "Copied"; }
    catch { input.select(); }
  });
  return copy;
}

/** Replace the create-dialog body with the share link + copy / open actions. */
function showShareLink(/** @type {HTMLElement} */ content, /** @type {HTMLElement} */ footer, /** @type {any} */ room) {
  const url = buildInviteUrl(location.origin, { room: room.id, token: room.shareToken });
  const input = linkPane(content, url, "Room created. Share this link — anyone with it joins the live board:");

  footer.replaceChildren();
  const right = el("div", "modal-footer-right");
  const open = el("button", "btn btn-pri", "Open room");
  open.setAttribute("type", "button");
  open.addEventListener("click", () => { location.href = url; });
  right.append(copyBtn(url, input), open);
  footer.append(right);
}

/**
 * #1: re-open the invite link from INSIDE a room. Reconstructs the current
 * room's link from its own params (no server round trip) with personal params
 * stripped, so each invitee sets their own name (the #3 gate handles them).
 * @param {{ room: string, token?: string | null }} source
 */
export function openInviteModal(source) {
  const url = buildInviteUrl(location.origin, source);
  const content = el("div", "modal-body");
  const input = linkPane(content, url, "Share this link to invite people to this room. Each person sets their own name as they join:");

  const footer = el("div", "modal-footer");
  const right = el("div", "modal-footer-right");
  const openTab = el("button", "btn btn-ghost", "Open in new tab");
  openTab.setAttribute("type", "button");
  openTab.addEventListener("click", () => { window.open(url, "_blank", "noopener"); });
  const done = el("button", "btn btn-pri", "Done");
  done.setAttribute("type", "button");
  right.append(copyBtn(url, input), openTab, done);
  footer.append(right);

  const modal = openModal({ heading: "Invite to this room", content, footer });
  done.addEventListener("click", () => modal.close());
}
