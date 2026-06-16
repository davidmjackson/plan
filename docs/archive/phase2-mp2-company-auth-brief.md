BRIEF MP2: Productionise slice 2 — company-only rooms + real @suite/auth-client (plan-side; hub registration handed off)

(Second productionise slice. Builds on MP1's room store + the proven server. One slice, RoE cadence, TDD, branch `feat-mp2-company-auth` off `feat-mp1-client-sync`.)

Read first: docs/phase2-mp1-client-sync-brief.md (the room store + dual-mode it extends), server/server.js (the upgrade handler + decideUpgrade already enforce company-only vs open-link, spike case 7), server/auth-seam.js (today's stub verifySession this slice generalises), and the integration recipe established this session from /var/www/suite/shared/auth-client (createAuthClient: factory.js:11-37), /var/www/retrospective/server.js:37-44,700-722 (the model: construct the client, mount 5 routes, requireAuth+requireEntitled gating), retrospective/lib/upgradeAuth.js (verifySession on the ws upgrade), suite/hub/config.js:20-25 + hub/routes/launch.js:6-11 + hub/db/migrations/002-identity-entitlements.sql (registration).

DIRECTOR RULING ON SCOPE (decided this session)
PLAN-SIDE NOW, HUB REGISTRATION HANDED OFF. This slice builds and tests the plan-side auth integration locally. It makes NO edits to /var/www/suite and handles NO secrets. The hub registration (config.js api key, HUB_API_KEY_PLAN secret, ALLOWED_APP_DOMAINS, launch.js APP_DOMAIN, the entitlement grant) and the live deploy are David's, captured as a checklist (docs/phase2-mp2-hub-registration.md). Inherits the standing rulings: free + accounts + UNUSED charge-later seam; dual-mode (the local single-user app is untouched).

GOAL
Let company-only rooms work with REAL hub identity, without a hub in the test loop. Generalise plan's auth into a provider seam with two implementations — the existing stub (tests + open-link dev) and a real @suite/auth-client adapter wired behind env config — and add the authed room-creation path that company-only rooms require. The company-only ENFORCEMENT already exists (decideUpgrade, spike case 7); this slice makes identity real and gives a company-only room a way to be created by an authed manager.

THE LOAD-BEARING SEAM (why this stays testable without a hub)
decideUpgrade already takes verifySession as a parameter — so the conflict/auth logic is tested by INJECTING a fake verifySession, exactly as the spike does. The real @suite/auth-client only needs to be CONSTRUCTED and have its methods handed to the server; it is never called in the unit loop. So: a provider interface the server consumes, a stub provider for tests, and a real adapter that is dynamically imported ONLY when env-configured (so module load and CI never need the package or the hub).

RULINGS (R1–R6)
- R1 AUTH IS A PROVIDER SEAM. `server/auth.js` exports `createAuthProvider({ env })` returning `{ mode, verifySession, requireAuth, mountRoutes(app), companyOf(req) }`. Default (no HUB_BASE_URL) = the STUB provider (wraps server/auth-seam.js; requireAuth is a pass-through that reads a test session; companyOf reads the stub session). Configured = the REAL adapter.
- R2 THE REAL ADAPTER IS LOADED LAZILY, BEHIND ENV. The real adapter `await import("@suite/auth-client")` and `createAuthClient({ appName:"plan", hubBaseUrl, hubApiKey, cookieName:"plan_session", cookieDomain, dbPath })` happens ONLY inside createAuthProvider when env.HUB_BASE_URL is set. It must NOT be a static import (CI has neither the package nor the hub). The package dependency is part of the hand-off, NOT added to package.json this slice (it would break `npm ci`).
- R3 verifySession ON THE WS UPGRADE COMES FROM THE PROVIDER. The server uses `auth.verifySession(req.headers.cookie)` (real) — note the real client reads the COOKIE header, the stub reads `x-spike-session`; the provider hides that difference. decideUpgrade is unchanged (company-only requires a session whose company === room.companyId; open-link needs only the token; no cross-company leak).
- R4 COMPANY-ONLY ROOMS ARE CREATED BY AN AUTHED MANAGER. New `POST /rooms` endpoint, gated by `auth.requireAuth`: body picks the mode; a company-only room is scoped to `auth.companyOf(req)` (the manager's company, NEVER a client-supplied companyId); returns `{ id, shareToken, mode, companyId }`. Open-link rooms may also be created (mode in the body). Room-creation UI stays slice 4; this is the endpoint only.
- R5 THE CHARGE-LATER SEAM STAYS UNUSED. plan registers WITH an entitlement (hand-off) but never calls consume() — exactly as retro/poker. No quota, no billing, no consume() call anywhere in this slice.
- R6 DUAL-MODE + MP1 UNCHANGED. The local single-user app and MP1's open-link path are untouched. Open-link rooms still need no session. Nothing in the shipped client/actions/schema/validatePlan changes.

WHAT THIS SLICE BUILDS
1. `server/auth.js` — `createAuthProvider({ env })` (R1/R2): stub by default; real @suite/auth-client adapter when env-configured (dynamic import). Exposes verifySession, requireAuth, mountRoutes, companyOf, and a `mode` ("stub" | "real").
2. `server/server.js` — accept an injected `auth` provider (default `createAuthProvider(process.env)`); use `auth.verifySession` on the upgrade; `auth.mountRoutes(app)` when serving; add `POST /rooms` gated by `auth.requireAuth` (R4). Keep startSpikeServer's existing options working (the spike/MP1 tests pass a stub or rely on the default).
3. `docs/phase2-mp2-hub-registration.md` — the hand-off checklist: the 5 suite edits (config.js apiKeys.plan, .env HUB_API_KEY_PLAN, ALLOWED_APP_DOMAINS, launch.js APP_DOMAIN.plan, entitlement grant), plan's runtime env vars (APP_NAME/HUB_BASE_URL/HUB_API_KEY/COOKIE_DOMAIN/APP_SESSIONS_DB), and how plan references the shared auth-client package (file: dep or vendored — a deploy decision), with the exact file:line citations from the recipe.

ASSERTED OUTCOMES (TDD, injected stub provider)
- create a company-only room as an authed manager → the room's companyId is the MANAGER's company (from the session), not any client-supplied value (R4).
- join that room as a same-company member → upgrade accepted, identity "verified".
- join as a DIFFERENT company's session → refused 403, no cross-company leak (decideUpgrade, now through create→join).
- join with NO session → refused 401.
- create + join an open-link room → token-gated, identity "claimed", no session needed (MP1 path intact).
- provider seam: createAuthProvider with no env → mode "stub"; with HUB_BASE_URL set → attempts the real path (mode "real"); the stub never imports @suite/auth-client.
- regression: all spike + MP1 + sync-client tests stay green; the default server still serves + seeds.

OUT OF SCOPE (parking lot)
- Any edit to /var/www/suite, any secret, the live hub deploy (hand-off doc only).
- Adding @suite/auth-client to package.json (would break npm ci; it is a deploy-time/file dep — hand-off).
- Per-entity rev + EDIT_STORY field-delta (slice 3).
- Room-creation/lifecycle UI, the blend-mode picker, share-link UI, import-local-plan, presence (slice 4).
- systemd packaging, backups, the live release (slice 5).
- consume()/quota/billing (R5: registered-but-unused only).

DEFINITION OF DONE
- `server/auth.js` provider seam built TDD; stub default, real adapter behind env (lazy import), the asserted outcomes green.
- `POST /rooms` authed creation, company scoped to the manager's session (R4), tested incl. cross-company refusal.
- Full suite + typecheck + drift green; spike/MP1 regression intact; the MP1 two-browser open-link path still works (re-verify).
- `docs/phase2-mp2-hub-registration.md` hand-off written, citation-accurate.
- I can explain every line; build-log entry drafted (AI drafts, David signs off).

START BY (no code before the failing test): write the create-company-room → join-enforcement tests against an injected stub provider, watch them fail, then build server/auth.js + the POST /rooms path. Then the provider-seam selection test. Then the hand-off doc.
