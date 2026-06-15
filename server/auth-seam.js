// @ts-check
/**
 * Phase 2 spike — the auth seam. In production this is
 * @suite/auth-client `verifySession(cookieHeader)` returning
 * { userId, entitled, teams, company } | null for a ws upgrade
 * (suite/shared/auth-client/lib/verify-session.js). For the spike it is a stub
 * keyed off a test header, so the spike stands up standalone of a live hub while
 * exercising the SAME boundary logic (refuse on no/invalid session, company on
 * the session). Wiring the real client in is a named follow-on seam, not built
 * here.
 *
 * @typedef {{ userId: string, company: string, entitled: boolean }} Session
 */

/** @type {Map<string, Session>} */
const SESSIONS = new Map();

/** Test/dev seam: register a session a header value will resolve to. */
export function registerTestSession(token, session) {
  SESSIONS.set(token, session);
}

/**
 * Resolve a session from request headers, or null. Mirrors verifySession(cookie):
 * accepts the `x-spike-session` header (server-to-server tests) OR a
 * `spike_session` cookie (so a browser, which can't set custom headers, can be
 * authed for verification — the real client is cookie-based too).
 */
export function verifySession(headers) {
  let token = headers["x-spike-session"];
  if (!token && headers.cookie) {
    const m = /(?:^|;\s*)spike_session=([^;]+)/.exec(headers.cookie);
    if (m) token = decodeURIComponent(m[1]);
  }
  if (!token) return null;
  return SESSIONS.get(token) || null;
}
