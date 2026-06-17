// @ts-check
/**
 * The ONE place the suite's URLs are defined, so a path change is a one-line
 * edit. Used by the entry gate (where to send an unauthed visitor) and logout
 * (where to send suite users vs guests). Prod origin is hard-coded; the gate
 * never redirects in dev (no auth system => treated as single-user), so dev
 * never reaches these.
 */
const SUITE_ORIGIN = "https://sprintsuite.uk";

/** Suite landing page — where every logged-out user is sent (suite user and
 * guest alike; the guest just sees a modal first). */
export function landingUrl() {
  return SUITE_ORIGIN + "/";
}

/** Where an unauthenticated direct visitor is redirected to launch plan. The
 * hub gates its own login, so the dashboard is the correct entry point. */
export function launchUrl() {
  return SUITE_ORIGIN + "/dashboard";
}
