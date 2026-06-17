// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { landingUrl, dashboardUrl, launchUrl } from "../public/js/suite-urls.js";

test("landingUrl is the suite root (guest logout destination)", () => {
  assert.equal(landingUrl(), "https://sprintsuite.uk/");
});
test("dashboardUrl is the suite dashboard (suite-user logout destination)", () => {
  assert.equal(dashboardUrl(), "https://sprintsuite.uk/dashboard");
});
test("launchUrl sends an unauthed visitor to the suite to launch plan", () => {
  assert.equal(launchUrl(), "https://sprintsuite.uk/dashboard");
});
