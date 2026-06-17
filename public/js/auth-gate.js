// @ts-check
/**
 * Phase 3 entry gate. Pure decision (decideEntry) + the whoami adapter
 * (fetchSession). The gate runs in main.js at boot, before anything renders.
 *
 * Threat model: single-user data is client-side localStorage and the source is
 * public, so this is a PRODUCT FUNNEL, not a security boundary — collaborative
 * rooms are already server-gated by decideUpgrade. A room link therefore always
 * bypasses the gate (link possession + the server token check is the real gate).
 *
 * DOM-free at import time: fetchSession touches `fetch` only when called, so
 * node:test can import decideEntry directly.
 */

/**
 * @param {{ hasRoomLink: boolean, session: "authed"|"anon"|"no-auth-system"|"error" }} input
 * @returns {{ mode: "room"|"single-user"|"redirect", hasSuiteSession: boolean }}
 */
export function decideEntry({ hasRoomLink, session }) {
  // A room link bypasses the gate entirely; the server enforces the token.
  if (hasRoomLink) {
    return { mode: "room", hasSuiteSession: session === "authed" };
  }
  // No link: a real session OR a dev box with no auth system mounted => the
  // single-user board. (no-auth-system keeps local dev working, where /auth/
  // whoami 404s because the stub provider mounts no routes.)
  if (session === "authed" || session === "no-auth-system") {
    return { mode: "single-user", hasSuiteSession: session === "authed" };
  }
  // No link, anon or whoami error (fail closed) => out to the suite.
  return { mode: "redirect", hasSuiteSession: false };
}

/**
 * Ask the server who we are. `redirect:"manual"` so the real auth-client's
 * 302→hub-login surfaces as an opaqueredirect (status 0) rather than fetch
 * following it cross-origin. 404 = no auth routes mounted = dev/stub.
 *
 * VERIFY-STEP (Task 7): confirm the real handleWhoami's 2xx body shape. This
 * adapter assumes a 2xx with an explicit boolean flag (authenticated/loggedIn)
 * or a userId; absent any flag on a 2xx it assumes authed.
 * @returns {Promise<"authed"|"anon"|"no-auth-system"|"error">}
 */
export async function fetchSession() {
  let res;
  try {
    res = await fetch("/auth/whoami", { redirect: "manual" });
  } catch {
    return "error";
  }
  if (res.status === 404) return "no-auth-system";
  if (res.status === 401 || res.status === 0 || res.type === "opaqueredirect") return "anon";
  if (!res.ok) return "error";
  let body = /** @type {any} */ ({});
  try { body = await res.json(); } catch { /* non-JSON 2xx: fall through to authed */ }
  if (typeof body.authenticated === "boolean") return body.authenticated ? "authed" : "anon";
  if (typeof body.loggedIn === "boolean") return body.loggedIn ? "authed" : "anon";
  if (body.userId != null) return "authed";
  return "authed";
}
