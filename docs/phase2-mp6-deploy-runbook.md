# MP6 deploy runbook — launching the multiplayer rooms service

The ordered steps to take plan from "static apache site" to "static site + a running multiplayer service", on the live box. The in-repo artifacts (entrypoint, systemd unit, apache snippet, /health) are built; this runbook is the director's to execute (it touches secrets, the suite/hub, systemd, and apache). Run commands one at a time and check each before the next.

**Topology:** apache keeps serving the static client at sprintplan.uk (the free local app, unchanged) and reverse-proxies the dynamic surface (ws upgrade, `/rooms`, `/auth/*`, `/api/heartbeat`, `/auth-client/`) to the node service on `127.0.0.1:3014`. The browser stays same-origin — no CORS, no client change.

---

## 0. Prereqs
- main merged (foundation + MP1–MP6) and pulled on the live box (`git -C /var/www/plan pull --ff-only`).
- Node + the deps installed: `npm ci --omit=dev` won't include `@suite/auth-client` (see step 3). `ws` + `better-sqlite3` are in package.json; `better-sqlite3` builds a native binary on `npm ci`.

## 1. Hub registration (the suite repo — its own PR + deploy)
Do every step in `docs/phase2-mp2-hub-registration.md`: generate `HUB_API_KEY_PLAN`; add `plan` to `hub/config.js` apiKeys, `ALLOWED_APP_DOMAINS`, and `hub/routes/launch.js` `APP_DOMAIN`; grant the entitlement; redeploy the hub. **The rooms service auth will not work until this is live.**

## 2. Create the data dir (durable db, R4)
The rooms db must be persistent and OUTSIDE the static-served `public/` tree.
```bash
mkdir -p /var/www/plan/data
```
Back it up with the box's existing backup job (it is a single SQLite file, e.g. `/var/www/plan/data/rooms.db`). It is created on first start.

## 3. Make @suite/auth-client resolvable (deploy-time dep)
It is intentionally NOT in package.json (would break `npm ci` where suite is absent). On the live box, where `/var/www/suite` exists, make it resolvable — match how the siblings do it (a `file:` install, a vendored copy, or a path link):
```bash
npm --prefix /var/www/plan install /var/www/suite/shared/auth-client
```
(Or vendor a copy, per the dragula precedent.) Confirm `node -e "import('@suite/auth-client').then(m=>console.log(typeof m.createAuthClient))"` prints `function` from `/var/www/plan`.

## 4. Env file (secrets — NOT committed)
Write `/var/www/plan/.env.rooms` (referenced by the systemd unit):
```
PORT=3014
ROOMS_DB=/var/www/plan/data/rooms.db
SERVE_STATIC=0
APP_NAME=plan
HUB_BASE_URL=https://sprintsuite.uk
HUB_API_KEY=<the HUB_API_KEY_PLAN hex from step 1>
COOKIE_DOMAIN=sprintplan.uk
APP_SESSIONS_DB=/var/www/plan/data/plan-sessions.db
```
`chmod 600 /var/www/plan/.env.rooms`.

## 5. Install + start the systemd service
Copy the unit, set `User=` to match suite-hub's deploy user, then:
```bash
sudo cp /var/www/plan/deploy/sprintplan-rooms.service /etc/systemd/system/
```
```bash
sudo systemctl daemon-reload
```
```bash
sudo systemctl enable --now sprintplan-rooms
```
```bash
curl -s http://127.0.0.1:3014/health
```
Expect `{"ok":true}`. `journalctl -u sprintplan-rooms -f` for logs.

## 6. apache reverse proxy (same-origin)
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite
```
Add the block from `deploy/apache-sprintplan-rooms.conf` INSIDE the existing sprintplan.uk `:443` VirtualHost, then:
```bash
sudo apachectl configtest
```
```bash
sudo systemctl reload apache2
```

## 7. Verify the live launch
- `https://sprintplan.uk/` still serves the static app (anonymous, local mode) — unchanged.
- Launch plan from the hub dashboard → lands authed (the `/auth/launch` proxy sets the `plan_session` cookie).
- Click **Collaborate live** → create a company-only room → a share link appears.
- Open the link as a same-company member → joins (presence shows both); a different company / no session is refused.
- Anonymous (no session): **Collaborate** → "Sign in via Sprint Suite" toast (the 401 path).

## Rollback
```bash
sudo systemctl stop sprintplan-rooms
```
The static site is unaffected (apache still serves it); only collaboration goes offline. Remove the apache block + reload to drop the proxy entirely.

---

## Deploy-model note (for the build log / Capstone)
This is the deploy-model inversion the feasibility doc flagged: plan joins suite-hub's operational class (a running service, a DB file to back up, a systemd unit, a connection lifecycle) on top of its original static-apache footprint. The static single-user app remains exactly as it was; multiplayer is the additive running service.
