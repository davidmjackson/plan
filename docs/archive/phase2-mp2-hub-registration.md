# MP2 hand-off — registering "plan" as a hub app (David's steps)

Slice MP2 built the plan-side auth integration (the provider seam + `verifySession` on the ws upgrade + authed `POST /rooms`), all tested locally against the stub. **The real `@suite/auth-client` path activates only when the env below is set, and it needs the hub to know about "plan".** This is the cross-repo + secrets + deploy work that is the director's, captured here. None of it is done in the plan repo or by the AI; all citations are into `/var/www/suite` and the sibling apps.

## 1. Generate the shared secret

One key, used in two places (they must match): `HUB_API_KEY_PLAN`.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. Hub-side changes (`/var/www/suite`, its own PR + deploy)

| Step | File | Change |
|---|---|---|
| api key | `hub/config.js:20-25` | add `plan: required("HUB_API_KEY_PLAN")` to `apiKeys` |
| hub env | `hub/.env` | add `HUB_API_KEY_PLAN=<the hex from step 1>` |
| app domains | `hub/.env` (`ALLOWED_APP_DOMAINS`) | append `https://sprintplan.uk` |
| launch map | `hub/routes/launch.js:6-11` | add `plan: "https://sprintplan.uk"` to `APP_DOMAIN` |
| entitlement | hub DB | grant an entitlement for "plan" (see step 4) |

Then redeploy the hub (`git -C /var/www/suite pull --ff-only` + `sudo systemctl restart suite-hub`, per the release notes).

## 3. plan-side runtime env (the live box, NOT committed)

Set these on the multiplayer service so `createAuthProvider` takes the real path (`server/auth.js`):

```
APP_NAME=plan
HUB_BASE_URL=https://sprintsuite.uk
HUB_API_KEY=<the same hex from step 1>
COOKIE_DOMAIN=sprintplan.uk
APP_SESSIONS_DB=/var/www/plan/data/plan-sessions.db
```

With `HUB_BASE_URL` unset (dev/CI), the provider stays the stub and never imports the package — so this slice is CI-safe.

## 4. Grant the entitlement (registered, but UNUSED — the charge-later seam, R5)

plan is free: register an entitlement so members are `entitled`, but never call `consume()`. Per `hub/scripts/seed-default-entitlements.js:14-15`:

```bash
node /var/www/suite/hub/scripts/grant-entitlement.js plan company <companyId>   # unlimited
```

`app_entitlements` columns (`hub/db/migrations/002-identity-entitlements.sql:38-51`): `quota_limit = null` = unlimited. plan calls `consume()` nowhere (like retro/poker, `retrospective/server.js:712`), so no quota is tracked.

## 5. The shared package dependency (a deploy decision — NOT in package.json)

The real adapter does `await import("@suite/auth-client")`. plan does **not** add it to `package.json` (a `file:` dep to `/var/www/suite/shared/auth-client` would break `npm ci` where suite is absent — e.g. CI). On the live box, make the package resolvable by one of: a `file:` dependency installed manually, a vendored copy (the dragula precedent — per-app copies are accepted, a shared install is a suite-level change), or a node `--experimental` path alias. Confirm how the siblings resolve it (`retrospective`'s import of `createAuthClient`) and match that.

## 6. Verify against the live hub (the real-path proof this slice could not do locally)

After 1–5: launch plan from the hub dashboard → confirm an app-session cookie is set → create a company-only room (`POST /rooms` while authed) → join from a same-company member (verified) and confirm a different-company session is refused (403). The plan-side logic for all of this is already tested (`tests/mp2-company-auth.test.js`); this step proves the real hub round-trip.

---

**Citations** (all read-only, from this session's investigation): `suite/shared/auth-client/lib/factory.js:11-37` (config), `retrospective/server.js:37-44,700-722` (wiring model), `retrospective/lib/upgradeAuth.js:5-16` (verifySession on upgrade), `suite/hub/config.js:20-25`, `hub/routes/launch.js:6-11`, `hub/db/migrations/002-identity-entitlements.sql:38-51`, `raid/lib/extractHandler.js:25-35` (consume, which plan does NOT use).
