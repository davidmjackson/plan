# Phase 2 — Multiplayer feasibility: code-level findings

**Status:** Pre-brief research. Hand-off for the Phase 2 planner.
**Date:** 2026-06-15
**Author:** Claude Code (read-only investigation of sibling repos)
**Scope:** Validate the reuse assumptions behind the proposed Phase 2 multiplayer spike *before* a brief is written. Turns "lift X from sibling Y" from an assumption into a known quantity.

> Method: read-only inspection of `/var/www/scrumpoker`, `/var/www/retrospective`, and `/var/www/suite` (the `@suite/auth-client` package + hub). All claims below carry `file:line` citations into those repos. No files were modified.

---

## 1. The proposal under test

The Phase 2 spike was proposed as three reuse legs wired together:

1. Lift **scrumpoker's ws room layer** onto plan's store (real-time multiplayer).
2. Reuse **retro's SQLite persistence** for durability.
3. Adopt the **`@suite/auth-client` company contract** for tenancy.
4. Define the **conflict / data-loss guarantee** inside the brief before any code — *the load-bearing decision*.

This document reports what the code actually does against legs 1–3, then explains what that means for leg 4.

---

## 2. Leg-by-leg verdict

| Reuse leg | Code reality | Verdict |
|---|---|---|
| Poker **ws room layer** | Raw `ws` (8.18.2); **last-write-wins**; full-state snapshot rebroadcast; **in-memory only, zero persistence**; no versioning / OT / CRDT; tightly coupled to poker verbs (vote/reveal/roles). | **Transport + auth-upgrade reusable; the state/write model is the wrong shape for plan.** |
| Retro **SQLite persistence** | `better-sqlite3`; **synchronous per-mutation transactional commits** (excellent durability, tiny crash window); **normalized-relational, hardcoded to `well/improve/continue`**; **also last-writer-wins at row level** (no version columns). | **Durability *discipline* reusable; the schema is not. Provides no conflict resolution.** |
| `@suite/auth-client` **company contract** | First-class `companies` / `company_members` tenancy; `verifySession(cookie)` returns `{userId, entitled, teams, company}` for **ws upgrades**; server-side verifiable with cache + grace; poker already keys rooms `${companyId}-${room}`. | **Fully validated — ~80% free, the strongest leg, de-risked.** |

---

## 3. Detailed findings

### 3.1 Poker ws layer — LAST-WRITE-WINS, in-memory, poker-coupled

- **Transport:** raw Node `ws` 8.18.2 attached to an Express HTTP server; standalone Node process on port 3005 (`scrumpoker/server.js:39-48`). No systemd/pm2 in-repo.
- **Room model:** `Map<roomName, room>` in memory (`server.js:16`); a room is `{ users:Set, votesRevealed, facilitatorId, shareToken, lastActive }` (`lib/roomState.js:6-13`). Lazy-created on join, deleted when empty, 1-hour inactivity expiry. **No persistence — all room/vote state vanishes on restart.**
- **Write model — the key finding:** **last-write-wins, no exceptions.** A vote handler overwrites the field directly and rebroadcasts full state (`lib/wsHandlers.js:106` → `currentUser.vote = payload.vote; sendRoomState(...)`). No version vectors, no Lamport clocks, no op log, no authoritative serialization beyond Node's single-threaded message ordering. Concurrent edits to the *same* field → last message silently overwrites.
- **Protocol:** `{type, payload}` in; server emits **full-state snapshots** (`type:'updateState'`), not deltas (`lib/roomState.js:87-99`). Fine for 8 users × 5 fields; bandwidth-naive for a large backlog.
- **Reconnection:** on disconnect the participant is **removed and state is lost**; client must re-`login` as a fresh participant. No replay/recovery.
- **Coupling:** tight — `VOTE_VALUES`, `votesRevealed`, reveal/reset/round verbs, voter/facilitator/observer roles are all poker domain. The transport + join/leave + company-scoped upgrade are generic; the state machinery is not.

**Liftability: transport HIGH, state model LOW.** Plan's ordered, interdependent, versioned document cannot ride on LWW full-snapshot broadcast without losing edits.

### 3.2 Retro persistence — durable discipline, retro-specific schema, also LWW

- **Driver/setup:** `better-sqlite3` ^12.6.2; DB at `$RETRO_DB_PATH` (default `/var/www/retrospective/retros.db`) (`retrospective/db.js`).
- **Migration pattern (reusable):** `meta` table holds `schema_version` (currently **7**); idempotent `ensureSchema()` runs versioned steps on startup (`db.js:497-521`). v6→v7 wiped legacy data and **rebuilt everything at company scope**. *This version-meta migration idiom maps cleanly onto plan's existing `MIGRATORS` v1→v2 mental model.*
- **Persistence model:** **normalized relational** — three tables `retros` / `cards` / `actions` (`db.js:89-131`). **Not** snapshot-blob, **not** op-log. Load = read all + JOIN-aggregate into the in-memory doc (`db.js:523-600`); write = per-entity `UPSERT ... ON CONFLICT(id) DO UPDATE` (`db.js:183-324`).
- **Durability (the valuable part):** **synchronous, per-mutation, transactional.** Every card add/vote/move commits in a `db.transaction(() => …)` *before* broadcasting (`server.js:1110-1146`). Worst-case crash loss is essentially one in-flight mutation. (Only the 1-second timer tick is broadcast-without-persist until completion.)
- **Concurrency:** **last-writer-wins at row level** — UPSERT unconditionally overwrites; `updated_at` exists but is **not** used for conflict detection; no version/CAS columns. Two concurrent votes read 0 in-memory → one is lost.
- **Coupling:** tight — `column_type ∈ {well,improve,continue}` hardcoded, actions always link a source card, timer embedded in retro metadata.

**Liftability: durability discipline + migration idiom + transaction wrapper HIGH; schema LOW** (plan designs its own tables). **Provides no conflict resolution — it is LWW too.**

### 3.3 `@suite/auth-client` — real tenancy, server-side verifiable

- **Package:** `/var/www/suite/shared/auth-client/`; single factory `createAuthClient` (`index.js:12`) exposing `requireAuth`, `handleLaunch/Logout/Heartbeat/Whoami`, `getCurrentUser`, **`verifySession(cookieHeader)`**, `consume`, `staticAssets`.
- **Tenancy contract (first-class):** hub `companies` + `company_members(user_id, company_id, role)` (`suite/hub/db/migrations/002-identity-entitlements.sql:1-13`). At launch, `/api/sessions/exchange` resolves the user's company and returns `{ user, central_session_id, entitlement, teams, company }` (`hub/routes/api-sessions.js:39-59`). Company flows into the local app-session row and onto `req.user.company` (`shared/auth-client/middleware.js:49`).
- **Auth model:** passwordless magic-link → hub central session → short-lived launch token → app exchanges it for its **own** local SQLite app-session. No passwords, no OAuth/Clerk/Auth0; the hub is the sole IdP. Cache TTL (60s) + grace (5min) keep apps working through hub hiccups.
- **Server-side verification for ws (key):** `verifySession(cookieHeader)` returns `{ userId, entitled, teams, company }` or `null` for **WebSocket upgrades** — no redirect, no per-message hub call (`shared/auth-client/lib/verify-session.js`). Poker already uses it: `decideUpgrade` (`scrumpoker/lib/wsServer.js:17-28`) then scopes the room `${companyId}-${room}` (`wsHandlers.js:43-53`).
- **Entitlements:** `app_entitlements(principal_type ∈ company|team|user, quota_limit, quota_period)`; `resolveEntitlement(userId, app)` checks all three scopes (`hub/lib/entitlements.js:79-86`). RAID gates via `auth.consume()` (`raid/lib/extractHandler.js:25-35`, default 25/month/user). A free/ungated app simply doesn't call `consume()` (or is granted unlimited).

**Reuse: ~80% of tenancy enforcement is free** (auth, company context at HTTP *and* ws, freshness/grace, entitlements). **You still build:** `company_id` columns + `WHERE company_id = ?` on your own data, per-message company validation (`payload.companyId === ws.company.id`), app-internal permission rules, and a hub provisioning entry for the new app.

---

## 4. The structural correction — model on retro, don't graft poker

The proposal decomposes Phase 2 as *"poker's ws layer **+** retro's SQLite."* The code shows that's a false split:

**Retro is already ws + SQLite + company-scope in one app.** It has its own ws layer (`addCard`/`voteCard`/`moveCard` → `broadcastToRetro`) on top of the durable per-mutation `better-sqlite3` store, company-scoped (v7). Poker's ws layer is the *inferior* of the two — ephemeral, in-memory, LWW-snapshot — and since **both ws layers are last-write-wins anyway**, grafting poker adds nothing over retro.

**Recommendation:** instruct the brief to **model plan wholesale on retro** (ws + durable + tenant-scoped, the proven triad), making plan the *third* app in an established suite pattern. Borrow from poker only as a secondary reference. This is reassuring for all the plumbing — none of it is novel for the suite.

---

## 5. What this means for leg 4 (the load-bearing decision)

**The conflict-resolution / data-loss guarantee exists nowhere in the suite.** Poker is LWW; retro is LWW; auth-client doesn't touch it. **Every reusable leg is plumbing.** The one genuinely hard thing — reconciling concurrent edits to plan's *ordered, interdependent, versioned* document — is net-new work no sibling has solved.

Concrete collision cases plan must answer that poker/retro never face:
- Two users drag the **same story** to different sprints simultaneously.
- One user **adds a dependency** while another **deletes the blocker story** in the same window.
- Concurrent reorders within a sprint (drag-ordering is position-sensitive).
- A mutation arriving against a stale schema version mid-migration.

So the brief should be honest that the spike is **not** "lift three things and wire them." It is:

> **Build a conflict/serialization model for plan's document, on top of proven auth + durable-persistence plumbing.**

All the risk concentrates in that one box; everything else is now a known quantity.

### 5.1 The seam that makes the guarantee cheap

Because retro **commits synchronously per-mutation inside a transaction**, an **authoritative-room + serialized-op** model gives plan a real data-loss guarantee almost for free — *provided* the client→server contract changes from poker's *"client sends the new value"* to *"client sends an operation."* The server then:

1. Receives an **op** (not a snapshot) over ws.
2. Applies it to the authoritative in-memory document **in arrival order** (Node's single thread serializes this for free).
3. **Commits the resulting state/op transactionally** (retro's discipline) *before* acking/broadcasting.
4. Rebroadcasts the applied op (or the new authoritative state) to the room.

This is the design seam to specify in the brief. The hard sub-decisions inside it: op granularity, whether ops carry a base-version for optimistic rejection, how rejected/late ops are surfaced to the user, and whether ordering alone suffices or specific operations (reorder, dep-add-vs-blocker-delete) need explicit semantic conflict rules.

---

## 6. Recommended sequencing for the planner

1. **Commercial fork first.** Run the `/30` opportunity score on *"should Phase 2 make plan a paid product?"* — it **constrains** the access model (link-possession vs account-gated vs blend), not the other way around. The entire stack here (accounts, tenancy, SQLite, ws service) *is* the architecture of a paid SaaS; if the answer is "stay free," most of it is over-built.
2. **Access model**, decided under that constraint.
3. **One multiplayer spike brief**, with leg 4 written as the spike's **pass/fail criterion** (does the authoritative-op model hold the data-loss guarantee on plan's document?), and the collaboration model pinned explicitly (real-time concurrent editing vs async shared-link — very different difficulty). **Keep Jira import a separate brief.**

### Two things the brief must not silently skip

- **Deploy-model inversion.** Today plan is static, apache-served, `git pull` to ship. Adding ws + SQLite makes it a **running service** (systemd like suite-hub, connection lifecycle, a DB file that needs backups) — it joins suite-hub's operational class. The brief owns this; it must not leak out as a surprise.
- **Coexistence / migration.** Every existing plan lives in browser localStorage, single-user, account-free. Upgrade path, dual-mode, or hard cutover — name it. This collides directly with the standing **account-free / backend-free** ruling, which Phase 2 partially reverses; that is a **director-level decision** (like the Brief 10 dashboard reversal).

---

## 7. One-line summary for the planner

> Auth/tenancy is free and proven (model on retro). Durability discipline is free (retro's synchronous per-mutation commits). The ws *state model* must be replaced — both siblings are last-write-wins — and the conflict/data-loss guarantee for plan's ordered, interdependent document is **net-new and the entire point of the spike**. Decide "paid product?" before "access model."

---

### Citation index

- Poker ws/LWW: `scrumpoker/lib/wsHandlers.js:106`, `lib/roomState.js:6-13,87-99`, `server.js:16,39-48`, `lib/wsServer.js:17-28`
- Retro persistence: `retrospective/db.js:89-131,183-324,497-521,523-600`, `server.js:1110-1146`
- Auth-client tenancy: `suite/shared/auth-client/index.js:12`, `middleware.js:49`, `lib/verify-session.js`; `suite/hub/routes/api-sessions.js:39-59`, `hub/db/migrations/002-identity-entitlements.sql:1-13`, `hub/lib/entitlements.js:79-86`; `raid/lib/extractHandler.js:25-35`
