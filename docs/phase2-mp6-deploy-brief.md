BRIEF MP6: Productionise slice 6 — the live launch (deploy artifacts + hand-off)

(Sixth and final productionise slice. The CODE/CONFIG artifacts are built here; the parts that go live — secrets, the suite/hub PR, the hub deploy, the live box — are the director's, captured in the runbook. One slice, RoE cadence, branch `feat-mp6-deploy` off main.)

Read first: docs/phase2-mp2-hub-registration.md (the hub-side checklist this runbook folds in), server/server.js (startSpikeServer — gains a /health route and a production entrypoint), docs/release-deploy.md-equivalent knowledge (sprintplan.uk is static apache + Let's Encrypt; the suite hub runs as a systemd service on the same live box — the model to mirror).

GOAL
Make the multiplayer service deployable and document the launch. Today plan is a static apache site; multiplayer adds a running ws + better-sqlite3 service. This slice produces: a production entrypoint, a systemd unit, the apache reverse-proxy config that keeps everything same-origin (no CORS, no client change), a liveness route, and a single ordered runbook. It changes NO multiplayer behaviour — only how it is started and fronted.

DEPLOY TOPOLOGY (the load-bearing decision, recommended)
ONE ORIGIN, APACHE FRONTS THE NODE SERVICE. apache keeps serving the static client at sprintplan.uk (the free local app, unchanged) AND reverse-proxies the dynamic surface to the node service on localhost: the ws upgrade, POST /rooms, /auth/* and /api/heartbeat. So the browser talks only to sprintplan.uk (same-origin ws + fetch — no CORS, no client URL change), and the node service runs serveStatic=false (apache owns static). The alternative (a rooms.* subdomain + CORS + a client URL config) is heavier and is noted but not chosen.

RULINGS (R1–R5)
- R1 NO BEHAVIOUR CHANGE. The op loop, auth provider, rooms, presence, and the client are untouched. This slice adds an entrypoint, a /health route, and deploy config only.
- R2 SAME-ORIGIN VIA APACHE PROXY. The client already builds a same-origin ws URL and posts to /rooms relative; apache proxies those + /auth/* + /api/heartbeat to the node service. No client change, no CORS. (If a subdomain is ever chosen, that is a separate change.)
- R3 THE REAL AUTH PATH IS ENV-GATED (MP2). The entrypoint constructs the provider from process.env; with HUB_BASE_URL set it is the real @suite/auth-client adapter, else the stub. The runbook lists the exact env + the package-resolution decision (deploy-time dep; not in package.json — would break npm ci).
- R4 DURABLE DB + BACKUPS. The rooms db is a persistent file (e.g., /var/www/plan/data/rooms.db); the runbook names the path, the backup step, and that it must NOT be the static-served public/ tree.
- R5 LIVENESS, NOT AUTH-GATED. A GET /health → 200 (no auth) for systemd/monitoring; everything else stays gated as built.

WHAT THIS SLICE BUILDS (in-repo)
1. server/server.js — a GET /health route (unauthed, before the gated routes) returning { ok: true }.
2. server/start.js — the production entrypoint: open the persistent rooms db (env ROOMS_DB or a default), startSpikeServer({ db, port: env.PORT||3014, serveStatic: env.SERVE_STATIC==="1" (default false), auth via env }), log the listen, and close cleanly on SIGTERM/SIGINT (systemd stop).
3. package.json — a "rooms" script: node server/start.js.
4. deploy/sprintplan-rooms.service — the systemd unit (WorkingDirectory /var/www/plan, ExecStart node server/start.js, Environment/EnvironmentFile, Restart=always, a non-root User, after network).
5. deploy/apache-sprintplan-rooms.conf — the reverse-proxy snippet to add to the existing vhost: WebSocket upgrade → node, plus ProxyPass for /rooms, /auth/, /api/heartbeat → node; static served by apache as today.
6. docs/phase2-mp6-deploy-runbook.md — ONE ordered runbook: hub registration (folds in the MP2 checklist) → secret → package resolution → db dir + backups → env file → systemd install/enable/start → apache proxy + reload → verify (/health, launch from hub, create a company-only room, a second member joins). Plus rollback (stop the unit; the static site is unaffected).

ASSERTED OUTCOMES
- GET /health → 200 { ok: true }, no auth required (TDD).
- server/start.js boots against a temp db and serves /health (smoke-verified: start, curl /health, SIGTERM, clean exit).
- regression: full suite + typecheck + drift green; the MP1 two-browser path still works.
- the runbook is complete and citation-accurate; the apache snippet keeps the static site same-origin.

OUT OF SCOPE (parking lot)
- Actually running the suite/hub PR, generating the secret, deploying the hub, or touching the live box (the runbook hand-off — the director's).
- A rooms.* subdomain / CORS path (noted alternative, not built).
- Horizontal scaling / Redis (single-process by design); log shipping/metrics beyond /health.
- Any multiplayer behaviour change.

DEFINITION OF DONE
- /health route + start.js entrypoint + the "rooms" script; systemd unit + apache proxy snippet + the runbook, all in-repo.
- /health tested; start.js smoke-verified to boot and stop cleanly; full suite + typecheck + drift green; MP1 path re-verified.
- The runbook folds in the MP2 hub registration and names the package-resolution + db-backup decisions.
- I can explain every line; build-log entry drafted (AI drafts, David signs off).

START BY (no entrypoint before the failing test): add the /health test (RED) → implement the route; then write start.js and smoke-boot it; then the systemd/apache files and the runbook.
