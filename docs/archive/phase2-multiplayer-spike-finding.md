# Phase 2 multiplayer spike — FINDING

**Verdict: GO (PASS).** All seven asserted cases hold. The authoritative-room + serialized-op model carries plan's zero-data-loss guarantee across the network boundary, with exactly one net-new conflict rule.

**Status:** Spike complete. Durable artefact per the build brief DoD.
**Date:** 2026-06-15
**Branch:** `spike-p2-multiplayer`
**Scope proven:** docs/phase2-multiplayer-spike-build-brief.md (cases 1–7). Settings-regenerate races, real-hub integration, presence/UI, and horizontal scaling were explicitly out of scope.

---

## 1. Verdict per case

| # | Case | Mechanism | Result |
|---|---|---|---|
| 1 | Same-story concurrent move | ungated; id-conserving remove-then-insert (`store.js:113`) | **PASS** — one placement, last move wins, no orphan/dup |
| 2a | dep-add THEN blocker-delete | atomic prune (`store.js:139`) | **PASS** — pair pruned, no dangling dep |
| 2b | blocker-delete THEN dep-add | `validatePlan` rejects dangling (`plan-io.js:80`) | **PASS** — link nacked, doc clean |
| 3 | Concurrent reorder in a sprint | ungated; arrival-order, last wins | **PASS** — single order, no loss/dup |
| 4 | Crash mid-flight | per-op transactional commit before broadcast | **PASS** — reopened db == last acked op |
| 5 | Stale `EDIT_STORY` (the clobber) | version-gate, reject-if-stale | **PASS** — winner kept, loser nacked `stale` (proven both at the op loop *and* over the wire from two real clients) |
| 6 | Rejected op is visible | nack to sender only | **PASS** — sender nacked, version/doc unchanged, other clients untouched |
| 7 | Auth + company scope at the boundary | `verifySession` seam + per-room blend policy | **PASS** — no-session refused (401), wrong-company refused (403, no leak), open-link `claimed`, member `verified`, bad token refused |

Tests: `tests/spike-op-loop.test.js` (cases 1–6 + vocabulary guard, driven directly against a real SQLite store) and `tests/spike-multiplayer.test.js` (case 7 + transport/broadcast + the wire-level clobber). 16 spike tests, all green; the full suite is 163/163, drift and typecheck clean.

## 2. The op vocabulary actually used

**9 wire ops**, as the PROPOSE settled — not the brief's original "17 actions":
- **Ungated** (arrival-order + `validatePlan`): `ADD_EPIC, EDIT_EPIC, DELETE_EPIC, ADD_STORY, DELETE_STORY, MOVE_STORY, LINK_DEP, UNLINK_DEP`.
- **Version-gated**: `EDIT_STORY`.
- **Excluded and enforced as rejected** by the op allow-list (`rooms.js`): the 6 `SET_*` settings/title ops, `LOAD_PLAN`, `NEW_PLAN`. The vocabulary-guard test confirms an excluded type is nacked `not allowed`, never reduced.

## 3. The conflict rules needed beyond arrival order

**Exactly one: the `EDIT_STORY` version-gate.** Everything else converged under arrival-order serialization plus plan's *existing* `validatePlan`, with zero bespoke logic — no reorder rule, no OT, no CRDT, no DFS. This is the headline result: plan's shipped reducer and load-boundary guard were already the right shape, so the spike's net-new surface is a single `if (baseVersion !== room.version)` check.

## 4. Honest tradeoffs and where the model fought back

- **Global-version false-conflict.** The version-gate uses a single monotonic doc version, so a stale `EDIT_STORY` is rejected even when the intervening op touched a *different* story. Safe (no data lost; the sender re-syncs and re-edits) but not maximally ergonomic. **Production refinement: per-entity `rev`** so only true same-story edit collisions reject.
- **`EDIT_STORY` is the lone value-semantics action.** It replaces all fields wholesale (`store.js:237-243`), which is why it needs the gate at all; `EDIT_EPIC` is already a partial-patch merge and needed none. **Production refinement: convert `EDIT_STORY` to a field-delta op** (like `EDIT_EPIC`) so concurrent edits to *different* fields of the same story merge instead of conflicting. This touches plan's shipped action shape, so it was correctly out of scope for the spike.
- **"Upgrade without a valid session is refused" vs open-link.** Reconciled by scoping the session requirement to `company-only` rooms; `open-link` rooms gate on share-token possession with a self-asserted (`claimed`) identity, never elevated to `verified`. Documented in `decideUpgrade` (`server.js`).
- **The wire-level clobber test is order-independent by construction** — it asserts "exactly one accepted, the other nacked `stale`" regardless of which client's op the server happened to serialize first, so it is robust to network timing rather than relying on it.

## 5. What this did NOT prove (named, not hidden)

- Settings-regenerate ops racing structural moves (parked by director ruling).
- Real `@suite/auth-client` round-trip (the seam was stubbed; the boundary logic is the same, the hub integration is a follow-on).
- Presence/cursors, the board UI over the wire, the blend UI (post-PASS feature work).
- Behaviour under real concurrent load / many participants; single-process ceiling (inherited knowingly).
- Coexistence with existing localStorage single-user plans (the spike is a parallel path; touched no `sprintplan:board` data).

## 6. Recommendation

**Productionise with named conflict rules.** The model is sound; the follow-on feature brief should:
1. Keep the authoritative-op loop verbatim (`reduce` → `validatePlan` → transactional commit → broadcast).
2. Adopt **per-entity `rev`** in place of the global-version gate to remove false-conflicts.
3. Convert **`EDIT_STORY` to a field-delta op** so different-field edits merge.
4. Wire the **real `@suite/auth-client` `verifySession`** in place of the seam.

**Director-level decisions still owed before that follow-on starts** (unchanged by this spike): the deploy-model inversion (static apache host → running ws + SQLite service, systemd, DB backups), localStorage coexistence/migration, and the entitlement/access-mode product shape.

## 7. Files (the spike, all net-new; the shipped client was reused by import, never edited)

- `spike/db.js` — better-sqlite3 store; retro's `meta.schema_version` migration idiom + per-mutation transactional commit; one validated plan-doc row per room.
- `spike/rooms.js` — `applyOp`: the op loop (allow-list → version-gate → imported `reduce` → imported `validatePlan` → commit).
- `spike/auth-seam.js` — `verifySession` stub seam (real `@suite/auth-client` is the named wiring point).
- `spike/server.js` — standalone ws service; `decideUpgrade` blend policy; authoritative in-memory room; broadcast/nack.
- `tests/spike-op-loop.test.js`, `tests/spike-multiplayer.test.js` — the seven-case proof.

New runtime deps: `ws`, `better-sqlite3` (the deploy-inversion the follow-on owns).
