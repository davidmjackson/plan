// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { landingUrl, launchUrl } from "../public/js/suite-urls.js";

test("landingUrl is the suite root (logout destination for suite users and guests)", () => {
  assert.equal(landingUrl(), "https://sprintsuite.uk/");
});
test("launchUrl sends an unauthed visitor to the suite to launch plan", () => {
  assert.equal(launchUrl(), "https://sprintsuite.uk/dashboard");
});
