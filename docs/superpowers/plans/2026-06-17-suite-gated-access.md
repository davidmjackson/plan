# Suite-gated Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the free anonymous direct-visit board — gate single-user access behind a Sprint Suite session, keep guest-via-shared-link collaboration, and add a logout button that routes suite users to the hub dashboard and guests (via a modal) to the suite landing.

**Architecture:** A client-side entry gate runs at boot (in `main.js`, before the store/name-gate) behind a full-screen overlay. A room link (`?room=`) bypasses the gate (link possession is the server-side gate via the untouched `decideUpgrade`); otherwise `/auth/whoami` decides: authed → render the existing localStorage board; anon → redirect to the suite. Pure decision functions (`decideEntry`, `decideLogout`) are unit-tested with `node:test`; the browser glue (boot gate, logout button, overlay, modal) follows the repo's established pattern of in-app (Playwright headless) verification rather than unit tests.

**Tech Stack:** Vanilla ES modules (no framework), `node --test` for unit tests, Playwright (CommonJS, headless) for in-app verification, existing `dom.js`/`modal.js` helpers.

## Global Constraints

- **Do NOT touch** the board, reducer, schema, `sync-client`, or `decideUpgrade` (`server/server.js`). This phase is an access shell only.
- **No server changes expected.** `/auth/whoami` and `/auth/logout` already exist on the real provider; the client calls them and does its own redirect. (Confirm `handleWhoami` response shape and `handleLogout` redirect behaviour during Task 7 — flagged inline.)
- Single-user data stays in `localStorage` (key `sprintplan:board`); no migration, no server persistence.
- Both room modes (`open-link`, `company-only`) are retained.
- Test runner: `node --test tests/*.test.js`; full suite must stay green (currently 233 tests). The drift gate (`npm test` runs `npm run drift` first) must stay `ok`.
- Suite origin is `https://sprintsuite.uk` (prod). Centralised in `suite-urls.js`.
- ES modules: all `import` statements go at the top of the file; pure modules must be DOM-free **at import time** (functions may reference `document`/`fetch`/`location` only inside their bodies) so `node:test` can import them.
- Commit after every task. Branch off `phase3-suite-gate` (this plan's branch); per the project's cadence, main stays frozen until PR.

## Deviation from the approved spec (READ FIRST)

The spec proposed a `guest-identity.js` module storing the guest name in `sessionStorage`, with a "wipe clears sessionStorage" test. **The existing code already achieves the spec's *intent* (ephemeral, per-tab, wiped-on-close identity) without it:** a guest's name lives in the per-tab URL (written by the name-gate via `history.replaceState`), and room mode never writes to `localStorage` (the autosave at `main.js:306` is guarded by `if (!IN_ROOM)`). The URL param is per-tab, survives refresh, and is gone on browser close — identical semantics to `sessionStorage`, with no second source of truth.

**This plan therefore drops `guest-identity.js`/`sessionStorage`** and instead (a) relies on the existing URL-param ephemerality and (b) locks the "room mode persists nothing" invariant with an explicit Playwright assertion (Task 7). This is a YAGNI simplification; if you want the explicit `sessionStorage` module regardless, say so and Task order is unaffected (it would be one more pure module). All other spec decisions are implemented unchanged.

## File Structure

| File | Responsibility | Tested by |
|------|----------------|-----------|
| `public/js/suite-urls.js` (new) | Suite URL config: `landingUrl()`, `dashboardUrl()`, `launchUrl()`. Single source of truth. | `tests/suite-urls.test.js` (unit) |
| `public/js/auth-gate.js` (new) | Pure `decideEntry({hasRoomLink, session})`; glue `fetchSession()` (calls `/auth/whoami`). | `tests/auth-gate.test.js` (unit, pure fn); Playwright (glue) |
| `public/js/logout.js` (new) | Pure `decideLogout({hasSuiteSession})`; glue `wireLogout()` (button + guest modal + redirect). | `tests/logout.test.js` (unit, pure fn); Playwright (glue) |
| `public/js/main.js` (modify) | Run the gate at boot; wire the logout button. | Playwright |
| `public/index.html` (modify) | Boot overlay element; Log out button. | Playwright |
| `README.md` (modify) | Update "free / no account" copy to "access through the suite". | n/a (docs) |

---

### Task 1: suite-urls.js — centralised suite URLs

**Files:**
- Create: `public/js/suite-urls.js`
- Test: `tests/suite-urls.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `landingUrl(): string`, `dashboardUrl(): string`, `launchUrl(): string` — all absolute URLs on the suite origin.

- [ ] **Step 1: Write the failing test**

```js
// tests/suite-urls.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/suite-urls.test.js`
Expected: FAIL — cannot find module `../public/js/suite-urls.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// public/js/suite-urls.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/suite-urls.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add public/js/suite-urls.js tests/suite-urls.test.js
git commit -m "feat: suite-urls.js — centralised suite URL config"
```

---

### Task 2: auth-gate.js — the pure entry decision + whoami adapter

**Files:**
- Create: `public/js/auth-gate.js`
- Test: `tests/auth-gate.test.js`

**Interfaces:**
- Consumes: nothing (pure fn); `fetchSession` uses the global `fetch` at call time.
- Produces:
  - `decideEntry({ hasRoomLink: boolean, session: "authed"|"anon"|"no-auth-system"|"error" }): { mode: "room"|"single-user"|"redirect", hasSuiteSession: boolean }`
  - `fetchSession(): Promise<"authed"|"anon"|"no-auth-system"|"error">` — calls `/auth/whoami`.

- [ ] **Step 1: Write the failing test** (pure `decideEntry` only — `fetchSession` is glue, verified in Task 7)

```js
// tests/auth-gate.test.js
// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideEntry } from "../public/js/auth-gate.js";

test("a room link always takes the room path, whatever the session", () => {
  for (const session of ["authed", "anon", "no-auth-system", "error"]) {
    assert.equal(decideEntry({ hasRoomLink: true, session }).mode, "room");
  }
});
test("room link + suite session => room, hasSuiteSession true", () => {
  const r = decideEntry({ hasRoomLink: true, session: "authed" });
  assert.equal(r.mode, "room");
  assert.equal(r.hasSuiteSession, true);
});
test("room link + no session => room as a guest (hasSuiteSession false)", () => {
  assert.equal(decideEntry({ hasRoomLink: true, session: "anon" }).hasSuiteSession, false);
});
test("no link + authed => single-user with a suite session", () => {
  const r = decideEntry({ hasRoomLink: false, session: "authed" });
  assert.equal(r.mode, "single-user");
  assert.equal(r.hasSuiteSession, true);
});
test("no link + no auth system (dev/stub) => single-user, no suite session", () => {
  const r = decideEntry({ hasRoomLink: false, session: "no-auth-system" });
  assert.equal(r.mode, "single-user");
  assert.equal(r.hasSuiteSession, false);
});
test("no link + anon => redirect (locked down)", () => {
  assert.equal(decideEntry({ hasRoomLink: false, session: "anon" }).mode, "redirect");
});
test("no link + whoami error => redirect (fail closed)", () => {
  assert.equal(decideEntry({ hasRoomLink: false, session: "error" }).mode, "redirect");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/auth-gate.test.js`
Expected: FAIL — cannot find module `../public/js/auth-gate.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// public/js/auth-gate.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/auth-gate.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add public/js/auth-gate.js tests/auth-gate.test.js
git commit -m "feat: auth-gate.js — pure entry decision + whoami adapter"
```

---

### Task 3: logout.js — the pure logout decision + button glue

**Files:**
- Create: `public/js/logout.js`
- Test: `tests/logout.test.js`

**Interfaces:**
- Consumes: `dashboardUrl`, `landingUrl` from `suite-urls.js`; `openModal` from `modal.js`; global `fetch`/`location` at call time.
- Produces:
  - `decideLogout({ hasSuiteSession: boolean }): { kind: "suite"|"guest" }`
  - `wireLogout({ button: HTMLElement|null, hasSuiteSession: boolean }): void`

- [ ] **Step 1: Write the failing test** (pure `decideLogout` only)

```js
// tests/logout.test.js
// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideLogout } from "../public/js/logout.js";

test("a suite session logs out as a suite user (=> dashboard)", () => {
  assert.equal(decideLogout({ hasSuiteSession: true }).kind, "suite");
});
test("no suite session logs out as a guest (=> landing, with modal)", () => {
  assert.equal(decideLogout({ hasSuiteSession: false }).kind, "guest");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/logout.test.js`
Expected: FAIL — cannot find module `../public/js/logout.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// public/js/logout.js
// @ts-check
/**
 * Phase 3 logout. Pure decision (decideLogout) + button glue (wireLogout).
 *
 * Two exits, branched on whether this browser holds a real suite session (NOT
 * on whether we are in a room): a suite user clears the cookie and returns to
 * the hub dashboard; a guest sees an informational modal, then goes to the
 * suite landing — their identity is already ephemeral (URL-only, wiped on close)
 * and room mode persists nothing locally, so there is no local state to clear.
 *
 * DOM-free at import time: document/fetch/location are touched only in bodies.
 */
import { openModal } from "./modal.js";
import { el } from "./dom.js";
import { dashboardUrl, landingUrl } from "./suite-urls.js";

/**
 * @param {{ hasSuiteSession: boolean }} input
 * @returns {{ kind: "suite"|"guest" }}
 */
export function decideLogout({ hasSuiteSession }) {
  return { kind: hasSuiteSession ? "suite" : "guest" };
}

/** Show the guest "You've logged out" modal; any close routes to `onDone`. */
function showLoggedOutModal(/** @type {() => void} */ onDone) {
  const content = el("div", "modal-body");
  content.append(el("p", "field-hint", "You've been logged out. You'll be taken to the Sprint Suite."));
  const footer = el("div", "modal-footer");
  const right = el("div", "modal-footer-right");
  const ok = el("button", "btn btn-pri", "Go to Sprint Suite");
  ok.setAttribute("type", "button");
  right.append(ok);
  footer.append(right);
  // onClose covers Escape/backdrop too, so every dismissal lands on the suite.
  const modal = openModal({ heading: "Logged out", content, footer, onClose: onDone });
  ok.addEventListener("click", () => modal.close());
}

/**
 * Wire the header Log out button. No-op if the button is absent.
 * @param {{ button: HTMLElement | null, hasSuiteSession: boolean }} deps
 */
export function wireLogout({ button, hasSuiteSession }) {
  if (!button) return;
  button.addEventListener("click", async () => {
    const { kind } = decideLogout({ hasSuiteSession });
    if (kind === "suite") {
      // Clear the plan_session cookie server-side, then go to the dashboard.
      // redirect:"manual" so a 302 from handleLogout doesn't throw cross-origin.
      try { await fetch("/auth/logout", { redirect: "manual" }); } catch { /* best-effort */ }
      location.replace(dashboardUrl());
    } else {
      showLoggedOutModal(() => location.replace(landingUrl()));
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/logout.test.js`
Expected: PASS (2 tests). If the import fails because `modal.js`/`dom.js` execute DOM at import time, move `decideLogout` into its own DOM-free module (e.g. `public/js/logout-decide.js`) and import it from both `logout.js` and the test; otherwise leave as-is.

- [ ] **Step 5: Commit**

```bash
git add public/js/logout.js tests/logout.test.js
git commit -m "feat: logout.js — pure logout decision + button glue"
```

---

### Task 4: Boot overlay + run the entry gate in main.js

**Files:**
- Modify: `public/index.html` (add boot overlay just inside `<body>`, line ~11)
- Modify: `public/js/main.js` (imports block ~line 8-37; gate runs after `IN_ROOM` at ~line 129, before the name-gate at ~line 144)

**Interfaces:**
- Consumes: `decideEntry`, `fetchSession` (Task 2); `launchUrl` (Task 1).
- Produces: a module-level `HAS_SUITE_SESSION` boolean consumed by Task 5.

- [ ] **Step 1: Add the boot overlay to index.html**

Insert immediately after the opening `<body ...>` tag (currently `public/index.html:11`):

```html
    <!-- Phase 3 boot overlay: covers the page until the entry gate decides, so
         the board never flashes before a redirect. Removed by main.js when we
         stay; left in place (and navigated past) on a redirect. -->
    <div id="boot-overlay" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#0b0f14;color:#cfd8e3;font:500 15px system-ui,-apple-system,sans-serif">
      Checking your session…
    </div>
```

- [ ] **Step 2: Add the gate imports to main.js**

In the import block at the top of `public/js/main.js`, add:

```js
import { decideEntry, fetchSession } from "./auth-gate.js";
import { launchUrl } from "./suite-urls.js";
```

- [ ] **Step 3: Run the gate after IN_ROOM is computed**

Immediately after the `IN_ROOM` line (`public/js/main.js:129`) and BEFORE the `// #3 name-on-join gate` block (~line 138), insert:

```js
// --- Phase 3 entry gate (suite-gated access) -------------------------------
// Before anything renders: a room link bypasses (server enforces the token);
// otherwise require a suite session or redirect out to the suite. The overlay
// in index.html covers the page until we know we're staying.
const sessionStatus = await fetchSession();
const entry = decideEntry({ hasRoomLink: IN_ROOM, session: sessionStatus });
if (entry.mode === "redirect") {
  location.replace(launchUrl());
  await new Promise(() => {}); // halt the module: the navigation is in flight
}
document.getElementById("boot-overlay")?.remove(); // staying — reveal the app
const HAS_SUITE_SESSION = entry.hasSuiteSession;
```

- [ ] **Step 4: Verify the unit suite still passes and the app boots in dev**

Run: `node --test tests/*.test.js`
Expected: PASS — all existing tests + the new ones (233 + 12 = 245). The gate code is not unit-tested here; full in-app verification is Task 7. Quick dev smoke (stub provider, no hub → `/auth/whoami` 404 → `no-auth-system` → board shows):

Run: `node server/dev-rooms.js` then load `http://127.0.0.1:3014/` in a browser — the overlay should flash then the board should render (no redirect, because dev has no auth system).

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/js/main.js
git commit -m "feat: run the suite-gated entry gate at boot behind an overlay"
```

---

### Task 5: Log out button — markup + wiring

**Files:**
- Modify: `public/index.html` (toolbar `.tbacts`, after the Sprint Suite link at ~line 50)
- Modify: `public/js/main.js` (import + wire near the other toolbar wiring, after the gate sets `HAS_SUITE_SESSION`)

**Interfaces:**
- Consumes: `wireLogout` (Task 3); `HAS_SUITE_SESSION` (Task 4).
- Produces: nothing.

- [ ] **Step 1: Add the Log out button to the toolbar**

In `public/index.html`, immediately AFTER the existing Sprint Suite return link (the `</a>` closing `class="btn btn-ghost btn-sm suite-return"`, ~line 50):

```html
        <!-- Phase 3: log out. Suite users → hub dashboard (cookie cleared);
             guests → "logged out" modal → suite landing. Wired in main.js. -->
        <button type="button" class="btn btn-ghost btn-sm" id="tb-logout">Log out</button>
```

- [ ] **Step 2: Add the logout import to main.js**

In the import block of `public/js/main.js`, add:

```js
import { wireLogout } from "./logout.js";
```

- [ ] **Step 3: Wire the button**

In `public/js/main.js`, after the gate block from Task 4 (so `HAS_SUITE_SESSION` is in scope) — placing it alongside the other toolbar wiring near the Collaborate button (~line 513) is fine:

```js
// Phase 3: the Log out button. Behaviour branches on whether this browser holds
// a real suite session (set by the entry gate), NOT on room vs single-user — a
// suite user in a room still logs out to the dashboard.
wireLogout({ button: document.getElementById("tb-logout"), hasSuiteSession: HAS_SUITE_SESSION });
```

- [ ] **Step 4: Verify unit suite still green**

Run: `node --test tests/*.test.js`
Expected: PASS (245). Button behaviour is verified in Task 7.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/js/main.js
git commit -m "feat: add Log out button (suite → dashboard, guest → landing)"
```

---

### Task 6: Update README for suite-gated access

**Files:**
- Modify: `README.md` (lines 5, 14, 18, and the Status section)

**Interfaces:** none.

- [ ] **Step 1: Update the three "free / no account" claims**

In `README.md`, make these exact replacements:

Line ~5 — replace:
`Part of the [Sprint Suite](https://sprintsuite.uk): ... Sprintplan (this app). A free, sign-in-free planning board you can also reach from the suite landing.`
with (keep the suite-links sentence; change only the trailing claim):
`Part of the [Sprint Suite](https://sprintsuite.uk): ... Sprintplan (this app). A planning board reached through the Sprint Suite.`

Line ~14 — replace:
`- Everything runs client-side: no account, no server, your data stays in your browser (local storage + JSON export/import)`
with:
`- Your single-user plan runs client-side: your data stays in your browser (local storage + JSON export/import). Access is through the Sprint Suite.`

Line ~18 — replace:
`No rooms, chat, or video (Teams owns that). No Jira sync in v1 (import is on the roadmap). No accounts. Not a SAFe ceremony suite. ...`
with (drop "No accounts."):
`No chat or video (Teams owns that). No Jira sync in v1 (import is on the roadmap). Not a SAFe ceremony suite. ...`

- [ ] **Step 2: Update the Status section**

Replace the Status paragraph with:

```markdown
## Status

**Live.** sprintplan.uk is deployed and in production over HTTPS. Access is through the Sprint Suite: open plan from the hub to use the single-user board, or join a colleague's shared room link to collaborate live (real-time cursors, presence, shared editing). See [docs/sprintplan-mvp-spec.md](docs/sprintplan-mvp-spec.md) for the locked scope.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README reflects suite-gated access (no longer sign-in-free)"
```

---

### Task 7: In-app verification (Playwright headless)

**Files:**
- Create: a throwaway verification script (not committed) under `/tmp`, per the project's headless recipe (CommonJS, `node`-driven Playwright).

**Interfaces:** none (verification only).

This task verifies all browser glue and locks the guest-ephemerality invariant. Follow the project's headless Playwright recipe (see the dev-env memory: CommonJS, headless). Use the dev server (`node server/dev-rooms.js`, stub provider) for the dev-open and room/guest flows, and assert the production gate logic via the pure tests already written. Because the dev/stub provider returns 404 for `/auth/whoami` (treated as `no-auth-system`), the *redirect* path cannot be exercised in dev — assert it against prod during the deploy UAT instead.

- [ ] **Step 1: Verify authed/dev single-user boot (overlay → board, no redirect)**

Start: `node server/dev-rooms.js`. Drive Playwright to `http://127.0.0.1:3014/`:
- Assert `#boot-overlay` is present at first, then removed (`document.getElementById('boot-overlay')` is null after load).
- Assert `#board` is visible and the `#tb-logout` button is present.

- [ ] **Step 2: Verify guest room join is unaffected + persists nothing locally**

Drive Playwright to `http://127.0.0.1:3014/?room=demo&token=demo` (the seeded open-link dev room):
- Assert the name-gate modal appears; submit a name; assert the board renders in room mode (`#room-live` not hidden).
- **Invariant:** assert `localStorage.getItem('sprintplan:board') === null` after editing in the room (room mode must persist nothing — this is the guest-ephemerality guarantee replacing the spec's sessionStorage module).

- [ ] **Step 3: Verify suite-user logout → dashboard**

In the dev single-user page, with `HAS_SUITE_SESSION` forced true for the test (dev is `no-auth-system` → false), assert the *decision* via `decideLogout({hasSuiteSession:true}).kind === "suite"` (already unit-tested in Task 3) and visually confirm clicking Log out navigates away. Full cookie-clear + dashboard redirect is confirmed on prod (Task 8 of the deploy UAT) because it needs the real provider.

- [ ] **Step 4: Verify guest logout → modal → landing**

On the room page, click `#tb-logout`:
- Assert the "Logged out" modal appears with the "Go to Sprint Suite" button.
- Assert clicking it navigates to `https://sprintsuite.uk/` (assert `location.replace` target via a stub or by intercepting navigation).

- [ ] **Step 5: Run the full unit suite once more**

Run: `npm test`
Expected: drift `ok` + `# pass 245 # fail 0`.

- [ ] **Step 6: Record verification results**

No commit (script is throwaway). Note in the PR description which flows were verified in dev vs deferred to the prod deploy UAT (the redirect path and the real `/auth/whoami` + `/auth/logout` behaviour — the two verify-steps flagged in Tasks 2 and the Global Constraints).

---

## Self-Review

**Spec coverage:**
- Lock single-user behind suite → Tasks 2 (decideEntry redirect) + 4 (gate runs). ✓
- Guest via shared link from a logged-in user → unchanged `open-link` rooms; gate bypasses on `?room=` (Task 2/4). ✓
- Logout → suite users to dashboard → Tasks 3 + 5. ✓
- Guests' session wiped on logout/close → URL-param ephemerality + "persists nothing" invariant (Task 7 Step 2); logout modal → landing (Tasks 3/5). Deviation from spec's sessionStorage documented above. ✓
- Guest logout modal → suite landing → Tasks 3 + 5. ✓
- Fail-closed on whoami error → `decideEntry` "error" → redirect (Task 2 test). ✓
- Keep both room modes → no change to `decideUpgrade` (Global Constraints). ✓
- Single-user stays localStorage → no change to autosave (Global Constraints). ✓
- README copy update → Task 6. ✓
- Accept stranded localStorage → no migration task (intentional). ✓

**Placeholder scan:** No TBD/TODO. Two explicit verify-steps (`/auth/whoami` body shape, `/auth/logout` redirect) are flagged as prod-UAT confirmations, not gaps — they cannot be exercised against the dev stub.

**Type consistency:** `decideEntry` returns `{mode, hasSuiteSession}` used consistently in Task 4. `session` union `"authed"|"anon"|"no-auth-system"|"error"` matches between `fetchSession` and `decideEntry` and the tests. `decideLogout` returns `{kind}` used in Task 3 glue. `HAS_SUITE_SESSION` produced in Task 4, consumed in Task 5. `wireLogout({button, hasSuiteSession})` signature matches between Task 3 and Task 5. ✓

## Out of scope (YAGNI)

- Server-backed per-account single-user persistence (a separate future phase).
- Real ephemeral guest server sessions / expiry (link-possession already gates).
- Server-side hard entry gate (apache/node) — future option if a true boundary is needed.
- Migration of stranded anonymous localStorage.
- Theme-matched styling of the boot overlay (uses a minimal inline style; polish later to avoid touching the drift-gated shared theme CSS).
