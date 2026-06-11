// @ts-check
/**
 * Id minting — the single impure boundary for identity. Ids are generated in
 * action creators (NOT the reducer), so the reducer stays pure and tests assert
 * exact state with explicit ids. Random (not a counter) so ids survive a reload
 * without colliding with persisted ones, and ride safely in JSON export/import.
 */

/**
 * @param {string} prefix  e.g. "epic" | "story"
 * @returns {string} e.g. "epic_4f3a9c1b"
 */
export function newId(prefix) {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  const rand = (bytes[0].toString(36) + bytes[1].toString(36)).slice(0, 10);
  return `${prefix}_${rand}`;
}
