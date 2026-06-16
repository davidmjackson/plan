BRIEF 10: Suite wiring (theme surface + return link + public tile) — the launch gate, not housekeeping

Read first: docs/sprintplan-mvp-spec.md (v0.5: non-goals "no accounts, login, or server-side
persistence; keeps compliance load at zero"; technical notes "all state client-side in v1, no backend
required to ship"; resolved decision 4 "full suite branding at launch"), docs/build-state-after-brief9.md
(the open housekeeping item: promote tokens + register plan as a theme SURFACE), and in the suite repo:
/var/www/suite/shared/theme/README.md, /var/www/suite/shared/theme/manifest.mjs,
/var/www/suite/shared/theme/glyphs.svg, /var/www/suite/shared/auth-client/README.md,
/var/www/suite/shared/auth-client/public/suite-return.js, /var/www/suite/hub/routes/launch.js,
/var/www/suite/hub/routes/landing.js, /var/www/suite/hub/views/landing.eta,
/var/www/suite/hub/views/dashboard.eta, /var/www/suite/hub/public/img/ (the shot-*.webp/png set),
/var/www/suite/README.md. RoE cadence applies: PROPOSE before you build. Feature branches per
workstream. No feature code until I approve the approach.

PRECONDITION (branch + repo model): Brief 9 is merged to plan/main first. This brief touches TWO repos
and lands as THREE PRs: (P) plan repo, (T) suite theme, (H) suite hub. Keep them separate so the
Capstone log maps cleanly. Order: T before P (the sync overwrites plan's public assets, so the shared
source must carry plan's identity first), H independent.

GOAL
Make sprintplan a visible, navigable member of the Sprint Suite WITHOUT making it an auth-gated app.
Three things: (1) register plan as a theme SURFACE so it shares and stays in sync with the Instrument
foundation; (2) a static "Return to Suite" link from the plan board to the hub; (3) a free-app tile on
the hub's PUBLIC landing linking out to sprintplan.uk, plus a README row so plan is a recognised suite
member in the docs. After this brief, plan looks like the suite, links into the suite, and is reachable
from the suite, while staying account-free and backend-free.

CANONICAL FACTS (confirmed from the suite repo, do not re-guess)
- Hub URL: https://sprintsuite.uk (hub/config.js BASE_URL; hub/.env.example; apache ServerName).
- plan's own domain: https://sprintplan.uk (spec).
- The suite currently knows FOUR apps everywhere: poker, retro, signal, raid. plan is absent from
  manifest.mjs SURFACES, hub APP_DOMAIN, hub api-key config, ALLOWED_APP_DOMAINS, the landing
  screenshots, and the suite README table. This brief adds plan only where a FREE, UNGATED app belongs
  (theme surface, return link, public landing, README), never to the gated launch/entitlement surfaces.
- The theme glyph sprite (shared glyphs.svg) defines #glyph-suite|raid|signal|retro|poker. No
  #glyph-plan yet; plan currently carries it as a local inline <symbol> in index.html.

HARD NON-GOAL (the ruling that shapes the whole brief)
plan does NOT join the authenticated launch/entitlement flow in v1. Do NOT mount @suite/auth-client,
do NOT add /auth/whoami, /auth/launch, /auth/logout, or /api/heartbeat to plan, do NOT add plan to the
hub's APP_DOMAIN, ALLOWED_APP_DOMAINS, api-key config, or grant entitlements, do NOT add accounts,
sessions, cookies, or any backend logic. The shared suite-return.js snippet is auth-client-dependent
(it reveals the button only after a successful /auth/whoami) and is therefore OUT: on an account-free
app it would never reveal. This honors the locked v1 non-goals (no accounts, no server-side persistence,
zero compliance load). Full auth membership is a Phase 3 decision, explicitly parked.

RULINGS (R1 to R6, director-ruled, do not silently change)
- R1 THEME SOURCE OF TRUTH IS THE SHARED REPO. plan's identity tokens move INTO the shared foundation,
  then sync down. Promote from plan's local plan.css / index.html into the shared source: the plum
  accent (--plum, --plumwash), the 8 epic-palette tokens, --dep-line, and the #glyph-plan symbol into
  /var/www/suite/shared/theme/glyphs.svg (joining #glyph-suite|raid|signal|retro|poker). Confirm the
  current homes and exact token names by reading plan/public/css/plan.css and plan/public/index.html
  (the local #glyph-plan with its "promote me" comment) against shared/theme/instrument-core.css. This
  is a MOVE, not a rename: the token names stay identical so plan.css keeps resolving them.
- R2 REGISTER THE SURFACE, THEN SYNC. Add { name: "plan", publicRoot: "/var/www/plan/public" } to
  SURFACES in shared/theme/manifest.mjs. Run shared/theme/sync-theme.mjs /var/www/plan to copy the
  foundation into plan/public/{css,js,illos,fonts}, then COMMIT the synced files: the source edits in
  the T-repo PR, the synced copies in the P-repo PR. The sync OVERWRITES plan's local
  instrument-core.css, oscilloscope.js, and glyphs.svg, so R1 must land first or plan loses #glyph-plan
  and its tokens.
- R3 DRIFT TEST IS A GATE. Add the check-theme-drift step for plan
  (node /var/www/suite/shared/theme/check-theme-drift.mjs /var/www/plan) to plan's test/CI, matching the
  sibling surfaces. A green drift check is part of DoD and a standing launch gate thereafter.
- R4 THE RETURN LINK IS STATIC AND ACCOUNT-FREE. Replace the dead, auth-dependent hidden anchor in
  plan/public/index.html (the <a class="btn btn-ghost btn-sm" data-suite-return hidden> placeholder)
  with a plain, always-visible link to https://sprintsuite.uk. Do NOT include
  /auth-client/suite-return.js and do NOT copy retrospective's return-to-suite.test.js (that test
  asserts the auth snippet, which plan must not ship). plan asserts the static link instead. This is a
  deliberate, logged divergence from the siblings: they are auth-gated so their button is auth-aware and
  ships hidden; plan is free so its link is static and always shown. PROPOSE the label ("Return to
  Suite" or "Sprint Suite") and exact topbar placement relative to the export/board controls.
- R5 THE TILE IS PUBLIC, NOT GATED, AND LANDING-ONLY (decided). Add plan to the hub's PUBLIC landing
  (hub/views/landing.eta) as a free/showcase tile linking to https://sprintplan.uk, alongside the
  existing poker/retro/signal/raid marketing tiles, with a shot-plan screenshot (match the existing
  shot-*.webp/png set in hub/public/img and its @2x variants) and the plan glyph. Do NOT add it to the
  authenticated dashboard (hub/views/dashboard.eta): that surface is for entitlement-gated launch tiles
  plan is not part of. ACCEPTED CONSEQUENCE (logged): hub/routes/landing.js redirects signed-in users
  to /dashboard, so signed-in suite users will not see the plan tile; only anonymous visitors will. If
  existing-user discovery later matters, a clearly-marked free dashboard tile is a separate follow-up,
  out of scope here. PROPOSE whether the tile is labelled "free" to set expectation against the gated
  apps. Also in the H-repo PR: add a Sprintplan row to the suite README "Apps in the suite" table
  (path /var/www/plan, domain sprintplan.uk, purpose "Delivery planning board").
- R6 NO BACKEND CREEP IN plan. plan/server.js stays a thin static host. No new route, no auth, no
  session, no DB. The hub URL is a build-time constant or a plain href in the markup, not a server
  endpoint or runtime config.

WORKSTREAMS
- (T) suite/theme: R1 promotions into instrument-core.css + glyphs.svg; R2 SURFACES += plan in
  manifest.mjs; run sync-theme; commit the source edits. PROPOSE the exact token names already used in
  plan.css so the promotion is a move, not a rename. Confirm the sibling drift checks still pass after
  the additive edits.
- (P) plan: commit the synced foundation copies; R4 static return link in index.html; remove the dead
  data-suite-return hidden anchor and the now-resolved "promote me" #glyph-plan comment; R3 drift-check
  step in package.json / CI.
- (H) suite/hub: R5 landing tile + shot-plan asset (+ @2x) + glyph + outbound link to sprintplan.uk;
  README row. Confirm placement by reading landing.eta and dashboard.eta first. Optional (flag, do not
  build without sign-off): a docs/architecture/plan.md to match the existing per-app architecture notes.

ASSERTED CASES (assert these outcomes; tests assert real values where a test layer exists)
1. DRIFT GREEN. check-theme-drift.mjs for /var/www/plan passes; plan/public foundation files are
   byte-identical to the shared source post-sync.
2. GLYPH SURVIVES SYNC. #glyph-plan resolves on the plan board after sync (now served from the shared
   glyphs.svg, not the local inline symbol), and the plum accent, epic palette, and dep-line render
   unchanged.
3. RETURN LINK WORKS WITHOUT AUTH. The board shows a visible link to https://sprintsuite.uk; it is
   keyboard-reachable with a :focus-visible ring; no /auth/whoami request is made; no console error;
   plan ships no auth-client snippet.
4. plan STAYS STATIC. plan/server.js exposes no new route; a grep confirms no auth/session/cookie code
   in plan; the sprintplan:board autosave envelope is unchanged by any of this (no persistence touch).
5. PUBLIC TILE LINKS OUT. The hub landing renders a plan tile with its screenshot and glyph linking to
   https://sprintplan.uk; the authenticated dashboard launch tiles are unchanged (plan absent there);
   the suite README lists Sprintplan.
6. SIBLINGS UNAFFECTED. The theme drift checks for hub/signal/retro/poker/raid still pass after the
   manifest and foundation edits (the promotions are additive); the hub launch/entitlement flow is
   untouched (plan absent from APP_DOMAIN, ALLOWED_APP_DOMAINS, api-key config).

OUT OF SCOPE (parking lot; do not "while we're here" these, RoE anti-pattern)
- Mounting @suite/auth-client; /auth/* endpoints; plan in APP_DOMAIN / ALLOWED_APP_DOMAINS / api-key
  config; entitlements or quotas for plan; the authenticated dashboard launch tile (all Phase 3 if plan
  ever becomes gated).
- Accounts, sessions, cloud save, multiplayer (P2/P3 per spec).
- Any plan feature work (the P1 fast-follow list is separate).
- The empty suite marketing/ dir ("planned"); the public tile goes in hub/views/landing.eta, not there.

BRANDING
The return link uses the plum accent and :focus-visible ring like every other plan control. The landing
tile matches the existing suite tile grammar (screenshot, glyph, one-line pitch). The plan glyph and
palette are now served from the shared foundation, so plan and the siblings cannot drift.

DEFINITION OF DONE
- plan is registered in manifest.mjs SURFACES; sync run; foundation committed in both repos; drift check
  green and wired into plan CI (R1, R2, R3).
- The board has a static, visible, account-free "Return to Suite" link to https://sprintsuite.uk; no
  auth-client snippet shipped; the dead hidden-anchor pattern and the resolved glyph comment removed
  (R4, R6).
- The hub public landing links out to https://sprintplan.uk with a screenshot and glyph; the
  authenticated dashboard is unchanged; the suite README lists Sprintplan (R5).
- Sibling surfaces still pass their drift checks and the hub launch/entitlement flow is untouched
  (R6, case 6).
- plan/server.js is still a thin static host; no backend, session, or persistence change (R6, case 4).
- I can explain every line. Build-log entries drafted for all three PRs (AI drafts, I sign off).

Start by PROPOSING: the exact token names to promote (read plan.css) and the glyphs.svg symbol id; the
manifest.mjs SURFACES line and the sync/commit order; the return-link label and placement; and the
landing-tile placement and "free" labelling (read landing.eta + dashboard.eta). No code yet.

SUGGESTED NEXT STEP
This is the last launch gate. After it: README (with the live suite links now real), the launch
checklist (licence, secrets, security alerts, plus the new drift-check CI step), then the closing
retrospective. Then declare MVP launched and move to the P1 fast-follow list.
