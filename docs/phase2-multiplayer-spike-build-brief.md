BRIEF P2.1-BUILD: Phase 2 multiplayer spike, the BUILD order (PROPOSE settled, now prove it)

(Numbering note: the BUILD half of BRIEF P2.1. The PROOF-framing brief is docs/phase2-multiplayer-spike-brief.md; this brief is what an implementer executes now that the PROPOSE is approved. Renumber to BRIEF 11+ if MVP-launch and any P1 fast-follow briefs land ahead of it.)

Read first: docs/phase2-multiplayer-spike-brief.md (the framing brief — THIS IS A SPIKE NOT A FEATURE, the director-level reversal, the three baked decisions, rulings R1–R7, the seven asserted cases, OUT OF SCOPE, the director-level follow-on decisions; all of that still governs and is NOT restated here). docs/phase2-multiplayer-spike-propose.md (the approved design gate — every decision below is from it; if this brief and the PROPOSE disagree, the PROPOSE wins and the gap is a bug in this brief). docs/phase2-multiplayer-feasibility.md (why retro is the model and both siblings are LWW). docs/build-state-after-brief10.md (what plan's code IS now). In the suite: /var/www/retrospective/db.js + server.js (the migration idiom + commit-before-broadcast), /var/www/scrumpoker/lib/wsServer.js + lib/upgradeAuth.js (ws upgrade + company-scoped room key — SECONDARY reference), /var/www/suite/shared/auth-client/lib/verify-session.js (the verifySession shape this spike stubs). RoE cadence applies: this is ONE slice (the proof). Feature branch (spike-p2-multiplayer). I can explain every line; build-log entry drafted (AI drafts, I sign off).

WHAT IS ALREADY DECIDED (do NOT reopen — these are the approved PROPOSE outcomes, not open questions)
- CONCURRENCY = version-stamped optimistic rejection. A single monotonic doc version, server-stamped, ++ per committed op. EDIT_STORY is rejected if its baseVersion != room.version. All other ops are ungated (arrival-order + validatePlan).
- OP VOCABULARY = 9 wire ops. Ungated: ADD_EPIC, EDIT_EPIC, DELETE_EPIC, ADD_STORY, DELETE_STORY, MOVE_STORY, LINK_DEP, UNLINK_DEP. Version-gated: EDIT_STORY. EXCLUDED from the wire: the 6 SET_* settings/title ops (parked) and LOAD_PLAN / NEW_PLAN (room-lifecycle; they replace/reset the whole authoritative doc, store.js:203-205, and must never be a participant's free op).
- PERSISTENCE = whole plan document per room as one validated row, committed transactionally per applied op BEFORE broadcast.
- HARNESS = thin Node ws two-client under node --test (NOT Playwright; no UI in scope, and raw ws gives deterministic op ordering for the "same window" collisions).
- BLEND POLICY = per-room mode on the room row; verifySession via a test seam.
- REJECTED OP = a nack to the originating socket only.

THE ONE RULE THAT IS NET-NEW (everything else is reuse)
The EDIT_STORY version-gate is the spike's single explicit conflict rule. Every other collision converges under arrival-order serialisation + plan's EXISTING validatePlan, which is PROVEN from plan's code (id-conserving moves store.js:113-127; atomic dep-prune store.js:139 / dangling-dep rejection plan-io.js:80; directional dup + self-dep rejection plan-io.js:77,87). The spike does not invent OT, CRDT, or DFS.

ISOLATION RULING (the spike is a PARALLEL path; reuse by import, never by edit)
The spike adds NEW files only and REUSES plan's shipped pure modules by importing them read-only:
- import { reduce } from "../public/js/store.js"  (the authoritative apply)
- import { validatePlan } from "../public/js/plan-io.js"  (the authoritative guard)
NO change to public/js/* — not the actions, not the reducer, not validatePlan semantics, not the schema. No existing sprintplan:board local plan is touched. If the build feels the urge to modify a shipped module, STOP — that is a signal the op model is wrong, which is itself a FAIL finding, not a licence to edit the client.

WHAT TO BUILD (the thinnest vertical; throwaway-tolerant; suggested file layout under a new spike/ dir)
1. spike/db.js — better-sqlite3 store. Table rooms(id, company_id, share_token, mode, plan_json, version, updated_at). Retro's idiom: a meta table with schema_version + an idempotent ensureSchema() on startup (v1 only, but prove the idiom transfers, R6). Expose: createRoom, loadRoom, and a per-op commit that writes plan_json + version inside db.transaction(() => …).
2. spike/auth-seam.js — verifySession(cookieHeader) seam returning { userId, entitled, company } or null. For the spike it is a stub keyed off a test header/cookie (real @suite/auth-client wiring is a named seam, not built here). Returns null on no/invalid session so case 7's refusal is real.
3. spike/rooms.js — the authoritative room + THE OP LOOP (the seam, verbatim from PROPOSE §7):
     on op {opId, type, payload, baseVersion}:
       if type === EDIT_STORY and baseVersion !== room.version: nack(opId, "stale: room at version " + room.version); return
       next = reduce(room.doc, {type, payload})
       v = validatePlan(next)
       if !v.ok: nack(opId, v.reason); return
       db.transaction(() => persist(room.id, next, room.version + 1))()
       room.doc = next; room.version++
       broadcast({ op:{type,payload}, version: room.version })
   Guard the op TYPE against the 9-op allow-list before reduce() — an excluded/unknown type is nacked, never applied (reduce() throws on unknown, store.js:262; do not let that crash the room).
4. spike/server.js — a standalone Node process (its own port, e.g. 3014; plan's static host is 3004) with an Express HTTP server and a ws server whose UPGRADE calls auth-seam.verifySession. Company-scoped room key (poker's `${companyId}-${room}`). Join enforces the room's blend mode: company-only requires a verified company member; open-link accepts a shareToken + a claimed display name, tagging the participant identity 'claimed' vs 'verified'. Seed a room from a minimal valid plan (createInitialState shape).
5. tests/spike-multiplayer.test.js — the two-client ws harness under node --test. Two ws clients against one room; drive the seven cases below; for each, RELOAD the persisted row and run validatePlan; assert exact outcomes.

PASS / FAIL — the seven asserted cases (from the framing brief; expected outcomes from PROPOSE §9)
1. SAME-STORY CONCURRENT MOVE — ungated; id-conserving remove-then-insert. Expect: one coherent placement, no orphan/dup, validatePlan clean, both clients converge.
2. DEP-ADD vs BLOCKER-DELETE, BOTH ORDERS (the headline, R4) — link-then-delete prunes (store.js:139); delete-then-link is nacked by validatePlan (plan-io.js:80). Expect: no dangling dep, validatePlan clean, both orders.
3. CONCURRENT REORDER WITHIN A SPRINT — ungated; arrival-order, last wins position. Expect: single converged order, no loss/dup.
4. CRASH MID-FLIGHT — kill after an op is acked, before the next; restart re-hydrates plan_json + version. Expect: persisted doc reflects exactly the acked ops, validatePlan clean; worst-case loss is one un-acked in-flight op.
5. STALE-VERSION OP (now concrete = the EDIT_STORY clobber) — two clients EDIT_STORY the same story against the same baseVersion. Expect: first commits, second is nacked "stale", no silent clobber.
6. REJECTED OP IS VISIBLE — any op failing validatePlan is nacked to its sender with validatePlan's reason; the room version does not move; other clients see no broadcast.
7. AUTH + COMPANY SCOPE — a ws upgrade with no valid session is refused; an op/join carrying a different company's room id is refused (404-class, no cross-company leak); both blend modes exercised (open-link claimed name never becomes 'verified').

PASS = all seven hold. FAIL = any case yields a doc that fails validatePlan on reload, a silent edit loss that breaches the bar, a cross-company leak, or divergence arrival-order + the EDIT_STORY gate cannot reconcile. A FAIL is a SUCCESSFUL spike (the model is wrong before we built on it). Write the finding either way.

DEPENDENCIES THE BUILD ADDS (name them in the build-log)
- ws (the transport) and better-sqlite3 (the store) become spike deps. Today plan's only runtime dep is express (server.js:4). Keep these scoped to the spike; do not entangle the shipped static client.

DEFINITION OF DONE
- The standalone ws + better-sqlite3 spike service stands up, auth-gated at the upgrade via the verifySession seam, company-scoped rooms, blend mode enforced at join.
- The 9-op loop applies ops in arrival order through the IMPORTED reduce() + validatePlan, version-gates EDIT_STORY, commits transactionally BEFORE broadcast, nacks rejects to the sender only.
- All seven cases run from the two-client node --test harness; each returns a clear PASS/FAIL with the persisted row reloaded and validatePlan-checked. Cases 2 and 5 are the gating ones (the headline race and the clobber the version-gate exists to catch).
- A written FINDING (the durable artefact) records: PASS/FAIL per case; that the op vocabulary used was the 9 ops; that the only explicit conflict rule needed beyond arrival-order was the EDIT_STORY version-gate (or, if more were needed, exactly which and why); the global-version false-conflict tradeoff and per-entity rev as the production refinement; and a recommendation (productionise as-is / productionise with named rules / model is wrong, here is why). On a FAIL, the finding is the deliverable; no follow-on feature brief until the model is sound.
- NO change to plan's shipped client, actions, schema, or validatePlan semantics; no sprintplan:board local plan touched (parallel path).
- I can explain every line. Build-log entry drafted (AI drafts, I sign off), candid about where the conflict model fought back.

OUT OF SCOPE — inherited verbatim from the framing brief (do NOT "while we're here" these)
Production board UI over the wire, presence/cursors/avatars; the read-only stakeholder share link; cloud-saved-plan management UI; Jira CSV import (separate brief); any paywall/billing/Stripe/tiers UI (R7: the unused consume() seam only); localStorage coexistence/migration of existing single-user plans; editing-rights modes (structural mutation is open to all to stress the conflict surface); horizontal scaling / Redis pub-sub (single process is correct for the proof); any change to plan's existing single-user client.

DIRECTOR-LEVEL DECISIONS THE FOLLOW-ON MUST TAKE (surfaced, NOT solved here)
- DEPLOY-MODEL INVERSION. A PASS makes plan a running service (systemd like suite-hub, connection lifecycle, a DB file needing backups), not a static apache git-pull host. The follow-on owns that operational class.
- COEXISTENCE / MIGRATION. Existing plans are local, single-user, account-free. Dual-mode vs import-into-room vs hard cutover is a director call (it partially reverses the v1 account-free ruling, already accepted for Phase 2).
- ENTITLEMENT / ACCESS-MODE PRODUCT SHAPE. Default blend mode and whether anything ever sits behind consume() is the commercial decision the optionality seam exists to keep open.

SUGGESTED NEXT
On a PASS: a follow-on feature brief productionising the proven model (board over the wire, presence, the blend UI), then separately the read-only stakeholder link, then Jira CSV import as its own brief — with the deploy-inversion and coexistence rulings decided before that follow-on starts. On a FAIL: a revised model brief addressing the specific collision that broke, before any multiplayer ships.
