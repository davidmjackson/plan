// @ts-check
/**
 * Pure, DOM-free room-join helpers (phase2-build4). The name-gate seam (#3) and
 * the re-openable invite-link builder (#1). No model/store/server contact: the
 * gate is a client-side UX guarantee, and the invite is reconstructed from the
 * joiner's own params. Unit-tested; the room boot and the invite modal consume them.
 */

/** The literal sentinel main.js/server.js fall back to when no name is supplied. */
const GUEST_SENTINEL = "guest";

/**
 * Decide whether a joiner needs the blocking name prompt. Empty, whitespace,
 * the "guest" sentinel (any case), and a missing param all need the prompt; a
 * real name is trimmed and passes.
 * @param {string | null | undefined} rawNameParam
 * @returns {{ name: string, needsPrompt: boolean }}
 */
export function resolveJoinName(rawNameParam) {
  const name = (rawNameParam ?? "").trim();
  const needsPrompt = name === "" || name.toLowerCase() === GUEST_SENTINEL;
  return { name: needsPrompt ? "" : name, needsPrompt };
}

/**
 * Reconstruct a shareable invite URL from the room id and (optional) token only.
 * A token => open-link-style link; no token => company-only link. Personal
 * params (name, etc.) are never read, so they can never leak into a shared link.
 * @param {string} origin  e.g. location.origin
 * @param {{ room: string, token?: string | null }} source
 * @returns {string}
 */
export function buildInviteUrl(origin, source) {
  let url = `${origin}/?room=${encodeURIComponent(source.room)}`;
  if (source.token) url += `&token=${encodeURIComponent(source.token)}`;
  return url;
}
