// @ts-check
/**
 * Epic colour palette — KEYS only. The actual oklch values live in plan.css
 * (`[data-epic-colour="plum"]` etc.) so the theme owns colour and dark-mode /
 * token changes stay central (G4 ruling).
 *
 * Plum is first (palette[0]); amber and red hues are deliberately ABSENT —
 * those are reserved for capacity semantics and must never colour an epic.
 * Keys are assigned by rotation at epic creation: PALETTE[epicCount % length].
 */

export const PALETTE = Object.freeze([
  "plum", // 290 — app accent, palette[0]
  "violet", // 265
  "indigo", // 240
  "teal", // 206
  "cyan", // 190
  "green", // 162
  "moss", // 140
  "magenta", // 320
]);
