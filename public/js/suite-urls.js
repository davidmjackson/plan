// @ts-check
/**
 * The ONE place the suite's URLs are defined, so a path change is a one-line
 * edit. Used by the entry gate (where to send an unauthed visitor) and logout
 * (where to send suite users vs guests). Prod origin is hard-coded; the gate
 * never redirects in dev (no auth system => treated as single-user), so dev
 * never reaches these.
 */
const SUITE_ORIGIN = "https://sprintsuite.uk";

/** Suite landing page — where a logged-out GUEST is sent. */
export function landingUrl() {
  return SUITE_ORIGIN + "/";
}

/** Suite hub dashboard — where a logged-out SUITE USER is sent. */
export function dashboardUrl() {
  return SUITE_ORIGIN + "/dashboard";
}

/** Where an unauthenticated direct visitor is redirected to launch plan. The
 * hub gates its own login, so the dashboard is the correct entry point. */
export function launchUrl() {
  return SUITE_ORIGIN + "/dashboard";
}
