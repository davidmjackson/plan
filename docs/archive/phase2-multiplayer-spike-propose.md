# Phase 2 multiplayer spike — PROPOSE (the design gate before build)

**Status:** PROPOSE. Answers the six open design calls in `docs/phase2-multiplayer-spike-brief.md`. No feature code until David approves the approach (RoE cadence).
**Date:** 2026-06-15
**Author:** Claude Code (grounded in a read of plan's actual reducers, validatePlan, and id-minting)
**Director rulings carried in this session:** concurrency = **version-stamped optimistic rejection**; settings ops = **parked (structural ops only)**.

> Method: this PROPOSE is not written from the brief alone. Every load-bearing claim below was checked against plan's source — `public/js/actions.js`, `store.js`, `validate.js`, `plan-io.js`, `ids.js`, `server.js` — with `file:line` citations. Where the brief's framing and the code disagreed, the code wins and the divergence is named.

---

## 0. Verdict — is the authoritative-op model correct?

**Yes, and it is correct *because of* how plan is already built**, not in spite of it:

- The reducer is **pure and total** (`store.js:188`), so it runs server-side unchanged.
- `validatePlan` is **pure, DOM-free, and already enforces every structural invariant the spike needs** (`plan-io.js:31`): conservation — no id in two arrays (`:51`); dangling-dep rejection (`:80-85`); duplicate-pair rejection, *directional* so A→B ≠ B→A (`:87`); self-dep (`:77`).
- Entity ids are **64 bits of `crypto.getRandomValues`** (`ids.js:13`), so a client-minted id rides safely on the wire with negligible cross-client collision — no server-side id authority needed.
- There is already an Express server "to give a future sync layer (ws) a home" (`server.js:3`).

The spike is genuinely *"prove a conflict model on proven plumbing,"* not *"wire three siblings together."* The single place the brief's "operations over values" principle was **not** actually true in the code — `EDIT_STORY` — is closed by the version-gate ruling below.

---

## 1. Op granularity & versioning

**Wire op:** `{ opId, type, payload, baseVersion }`.
- `opId` — client-generated correlation id, used only to match a `nack` back to its sender.
- `type` / `payload` — exactly an existing action's `{type, payload}` (the action *creators* already mint entity ids client-side, `actions.js:55,62,83`; that is safe per §0).
- `baseVersion` — the doc version the client believed it was editing against.

**Two tiers of op:**

| Tier | Ops | Server rule |
|---|---|---|
| **Ungated** | `ADD_EPIC, EDIT_EPIC, DELETE_EPIC, ADD_STORY, DELETE_STORY, MOVE_STORY, LINK_DEP, UNLINK_DEP` | Apply in arrival order; commit iff `validatePlan` passes. No version check. |
| **Version-gated** | `EDIT_STORY` **only** | Reject (nack `"stale"`) if `baseVersion !== room.version`; otherwise apply + validate + commit. |
| **Excluded from the wire** | `SET_START_DATE, SET_DURATION_MONTHS, SET_SPRINT_WEEKS, SET_VELOCITY, SET_BUFFER_PCT, SET_PLAN_TITLE, LOAD_PLAN, NEW_PLAN` | Not participant ops (see §7). |

**Why `EDIT_STORY` is the lone gated op:** it is the only whole-record-replace action — it rewrites title/summary/points/epicId wholesale from its payload (`store.js:237-243`). So two users editing *different fields of the same story* concurrently would silently clobber each other (B's op carries B's stale snapshot of the field A just changed). That is the exact poker last-write-wins failure R1 forbids, hiding inside an "action." `EDIT_EPIC`, by contrast, is already a **partial-patch merge** (`store.js:217-223`), so concurrent edits to different epic fields converge with no gate needed.

**Version model:** a single **monotonic integer `version`** held on the room, server-stamped, incremented once per committed op. Global, not per-entity — the thinnest vertical. The cost is a **safe false-conflict**: a stale `EDIT_STORY` is rejected even when the intervening op touched a *different* story. No data is lost (the sender is told and re-syncs); the edit is merely re-attempted. **Per-entity `rev` is named in the finding as the production refinement.**

---

## 2. Conflict rules beyond ordering

**The minimal set is exactly one explicit rule: the version-gate on `EDIT_STORY`.** Everything else resolves under arrival-order + `validatePlan` with no bespoke logic — proven from the code:

- **Same-story concurrent move / concurrent reorder** — `MOVE_STORY` is remove-then-insert with the id conserved (`store.js:113-127`). Applied in arrival order, the last move wins the placement; the id sits in exactly one array throughout. No reorder rule, no positional CRDT.
- **Dep-add vs blocker-delete (both orders)** — *link-then-delete*: `DELETE_STORY` atomically prunes the pair (`store.js:139`). *delete-then-link*: `LINK_DEP` blind-appends (`store.js:253`, no existence check) → `validatePlan` rejects the dangling pair (`plan-io.js:80`) → op nacked, never committed. Convergent both ways.
- **Duplicate-pair / self-dep races** — caught by `validatePlan` (`plan-io.js:77,87`).

No OT, no CRDT, no DFS. Arrival-order serialization (free on Node's single thread) plus the existing whole-document guard carries six of seven cases; the version-gate carries the seventh.

---

## 3. Persistence shape

**Whole plan document per room as one validated row.** Confirmed as the lean candidate, and the code backs it directly: `exportPlan` already produces a validated serialization (`plan-io.js:131`) and `validatePlan` already guards the whole doc in one pass. An op-log buys replay the spike does not need; retro's normalized tables solve relational-query problems plan does not have.

```
rooms(
  id          TEXT PRIMARY KEY,   -- company-scoped key, poker's ${companyId}-${room}
  company_id  TEXT NOT NULL,
  share_token TEXT NOT NULL,
  mode        TEXT NOT NULL,      -- 'open-link' | 'company-only'
  plan_json   TEXT NOT NULL,      -- the validated plan document
  version     INTEGER NOT NULL,   -- monotonic, matches §1
  updated_at  TEXT NOT NULL
)
```

Committed inside `db.transaction(() => …)` **per applied op, before broadcast** (retro's durability discipline). Keep retro's `meta.schema_version` + idempotent `ensureSchema()` migration idiom even at v1, to honour R6 and prove the idiom transfers. Crash recovery (case 4): on restart, re-hydrate `plan_json` + `version` from the row; worst-case loss is one in-flight, un-acked op.

---

## 4. Blend policy home

**Per-room**, chosen by the manager at room creation, stored as `rooms.mode`. (Per-company default is a product refinement — parked.) This matches the brief: "the manager creates the room and picks the mode."

**Identity shapes:**
- `company-only` join — must present a session `verifySession` accepts as a member of the room's company → participant tagged `{ identity: 'verified', userId, name, company }`.
- `open-link` join — shareToken + a **claimed display name** → participant tagged `{ identity: 'claimed', name }`.

The company name is always on the room record (always visible). The harness asserts an open-link joiner **never** acquires `verified` — a claimed name is never the membership guarantee (R5).

---

## 5. Two-client harness

**Recommendation: diverge from the brief's Playwright lean — use a thin Node `ws` two-client harness under `node --test`** (plan's existing runner; see `tests/*.test.js`).

Rationale: the board UI is explicitly out of scope, so a browser buys nothing, and raw `ws` clients give the **deterministic op-ordering the collision cases require** — both ops can be put on the wire before either ack returns, which is exactly the "same window" the cases assert. Poker reached for Playwright multi-context because it drove a *real UI*; this spike drives ops, not a DOM.

`verifySession` is exercised through a **test seam**: it returns a known `{userId, entitled, company}` for the authed path, or `null` to prove the refusal in case 7. This keeps the spike standalone of a live hub; the real hub round-trip is a follow-on integration concern, not part of proving the conflict model.

---

## 6. How a rejected / late op is surfaced

Server sends a **`nack` to the originating socket only**:

```
{ type: 'nack', opId, reason }
```

`reason` is `validatePlan`'s own human-readable string (the `{ok:false, reason}` it already returns) or `"stale: room at version N"`. **Other clients receive nothing** — the authoritative doc and every other participant are unaffected (R2: no silent drop, no collateral). The harness asserts: sender received the `nack` with the expected reason; the room version did not move; other clients saw no broadcast.

In a production client this surfaces as a toast plus a re-sync to the authoritative version. The client-side `sprintplan:board` autosave envelope remains the local backstop, untouched by the spike (R3).

---

## 7. The server loop (the seam, concretely)

```
on op {opId, type, payload, baseVersion} from socket:
  if type === EDIT_STORY and baseVersion !== room.version:
     → nack(opId, "stale: room at version " + room.version); return       // case 5
  next = reduce(room.doc, {type, payload})                                 // existing pure reducer, store.js:188
  v = validatePlan(next)                                                   // existing guard, plan-io.js:31
  if !v.ok: → nack(opId, v.reason); return                                 // case 6 / R2
  db.transaction(() => persist(room.id, next, room.version + 1))()         // retro discipline / R2
  room.doc = next; room.version++
  broadcast({ op: {type, payload}, version: room.version })                // ack + sync / R1
```

`validatePlan` stays the single load/guard spine it already is, now on the server side of the boundary (R2). Clients apply the broadcast op to their local store and adopt the broadcast `version`.

---

## 8. Corrections to fold into the brief

1. **Op count.** The brief says the op vocabulary is "the existing **17 actions**." The honest set is **9 wire ops** — 8 ungated + `EDIT_STORY` gated. The other 8 actions are deliberately excluded: 6 settings/title ops are parked (director ruling), and `LOAD_PLAN`/`NEW_PLAN` are room-lifecycle ops that replace or reset the whole authoritative document (`store.js:203-205`) — never a participant's free op.
2. **Case 5 is no longer hypothetical.** "Stale-version op" is the concrete `EDIT_STORY` clobber, now a real assertion driven by two clients editing the same story against the same `baseVersion`.
3. **`EDIT_STORY` is the only true value-semantics action.** "Operations over values" (R1) is already satisfied by every other op; `EDIT_STORY` is the lone exception and the version-gate is what brings it into line. (Productionising it as a field-delta op, like `EDIT_EPIC` already is, is named as a follow-on option — it touches plan's shipped action shape, which the spike does not.)

---

## 9. Impact on the seven asserted cases (expected outcomes)

| Case | Mechanism | Expected |
|---|---|---|
| 1 — same-story concurrent move | ungated; id-conserving remove-then-insert (`store.js:113`) | PASS, single placement |
| 2 — dep-add vs blocker-delete (both orders) | prune (`store.js:139`) / dangling-dep reject (`plan-io.js:80`) | PASS, no dangling dep |
| 3 — concurrent reorder | ungated; arrival-order, last wins position | PASS, single converged order |
| 4 — crash mid-flight | per-op transactional commit before broadcast | PASS, ≤1 un-acked op lost |
| 5 — stale-version op (the `EDIT_STORY` clobber) | version-gate, reject-if-stale | PASS, second editor nacked |
| 6 — rejected op is visible | nack to sender only | PASS, others unaffected |
| 7 — auth + company scope | `verifySession` seam; cross-company room id refused | PASS, no cross-company leak |

A FAIL on any case is a **successful spike** — it tells us the model is wrong before anything is built on it. The written finding is the durable artefact either way.

---

## 10. What this PROPOSE does NOT decide (still the director's, per the brief §"director-level decisions the follow-on must take")

Deploy-model inversion (static → running service), localStorage coexistence/migration, and the entitlement/access-mode product shape are unchanged by this PROPOSE — they are follow-on rulings. This document settles only the **six seam-design calls** the brief opened.
