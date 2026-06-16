BRIEF MP3: Productionise slice 3 — EDIT_STORY field-delta merge (drop the global-version gate)

(Third productionise slice. Pure plan-repo — no hub, no deploy. One slice, RoE cadence, TDD, branch `feat-mp3-conflict-refine` off `feat-mp2-company-auth`.)

Read first: docs/phase2-multiplayer-spike-finding.md §4/§6 (the global-version false-conflict + the two refinement ideas), docs/phase2-mp1-client-sync-brief.md (the room store/dispatch this extends), server/rooms.js (applyOp — the gate this removes + where the merge goes), public/js/sync-client.js (dispatch — where the delta is computed), public/js/store.js:237-243 (the shipped EDIT_STORY reducer — UNCHANGED by this slice).

DIRECTOR RULING ON THE MODEL (decided this session)
FIELD-DELTA MERGE, DROP THE GATE. The finding floated "per-entity rev" and "field-delta" as two ideas; investigation showed a per-STORY rev would reject two people editing DIFFERENT fields of the same story (the very false-conflict we want gone), so it is rejected. Instead: the client sends only the CHANGED fields; the server merges them against the LATEST authoritative story. Consequence, accepted on the record: different-field concurrent edits MERGE (the real clobber is fixed); same-field concurrent edits are silent LAST-WRITE-WINS (standard collaborative behavior — a deliberate, bounded relaxation of the spike's "no silent loss", limited to the one-field-two-editors case). This REFRAMES the spike's case 5 (no more "stale" nack on EDIT_STORY).

GOAL
Replace the blunt global-version gate on EDIT_STORY with a field-delta merge, so the productionised model neither clobbers different-field edits nor raises false-conflicts. Touch nothing in the shipped reducer/actions/schema: the delta is computed in the room-mode client (sync-client), and the merge happens server-side in applyOp.

RULINGS (R1–R5)
- R1 THE CLIENT SENDS A DELTA. In room mode, sync-client.dispatch for EDIT_STORY sends `{ id }` plus ONLY the fields whose value differs from the client's current view of that story (getState().stories[id]). Every other action is sent whole, unchanged. (The shipped card-editor/actions are NOT touched; the delta is derived in sync-client.)
- R2 THE SERVER MERGES AGAINST THE LATEST STORY. In applyOp, an EDIT_STORY op's payload is merged onto the CURRENT authoritative story before reduce: `{ ...room.doc.stories[id], ...payload }`. So the user's changed fields apply on top of whatever the latest state is — different-field edits compose; an edit naming a now-deleted story produces a partial story that validatePlan rejects (no silent resurrect).
- R3 THE GATE IS GONE; EDIT_STORY IS UNGATED. Remove the version-gate branch from applyOp. EDIT_STORY joins the arrival-order + validatePlan set. baseVersion stays in the wire protocol (clients still track/adopt the broadcast version) but the server no longer rejects on it. No op is version-gated after this slice.
- R4 BROADCAST THE MERGED OP, NOT THE DELTA. The shipped reducer's EDIT_STORY replaces all four fields from its payload, so a bare delta would null the untouched fields on every client. applyOp therefore returns the EFFECTIVE op (the merged full-field payload for EDIT_STORY; the original op otherwise) and the server broadcasts THAT, so each client reduces a complete payload.
- R5 NO SHIPPED-CLIENT/SCHEMA CHANGE. store.js, actions.js, validate.js, plan-io.js, the card editor — all unchanged. The local single-user app is unaffected (it never goes through sync-client). validatePlan stays the guard.

WHAT THIS SLICE BUILDS
1. `public/js/sync-client.js` — EDIT_STORY delta computation in dispatch (R1).
2. `server/rooms.js` — applyOp: merge EDIT_STORY against the current story (R2), drop the GATED set/gate (R3), return the effective op (R4).
3. `server/server.js` — broadcast `result.op` (the effective/merged op) instead of the raw `msg.op` (R4).
4. Test reframing (the spike's case 5 changes meaning): the op-loop, ws, and integration tests assert MERGE (different fields survive) and same-field LWW with NO nack, replacing the old "stale → nack" assertions.

ASSERTED OUTCOMES (TDD)
- sync-client unit: dispatching EDIT_STORY sends `{id}` + only the changed field(s); an unchanged field is omitted.
- op-loop: two EDIT_STORY ops to DIFFERENT fields of one story (partial payloads, applied in arrival order) → both fields survive in the persisted doc, validatePlan clean. Two ops to the SAME field → last wins, validatePlan clean, NO reject.
- op-loop: an EDIT_STORY delta naming a story deleted in the same window → validatePlan rejects (invalid points on the partial), surfaced as a nack — no silent resurrect (R2).
- ws + integration (the real sync-client over a socket): client A edits title, client B edits points of one story concurrently → both converge with BOTH changes (merge), no nack; same-field concurrent → both converge to one value (LWW), no nack.
- regression: every other spike/MP1/MP2 case stays green (only EDIT_STORY's conflict semantics changed); full suite + typecheck + drift green; the two-browser open-link path still works.

OUT OF SCOPE (parking lot)
- Per-field conflict nacks / preserving no-silent-loss for the same-field case (explicitly declined this session in favour of LWW).
- Any change to the shipped reducer/actions/schema/validatePlan or the card editor.
- Room lifecycle/import UI, presence (slice 4); systemd deploy + the MP2 hub registration (slice 5).
- Optimistic local echo (still pessimistic; a server round-trip per edit).

DEFINITION OF DONE
- sync-client computes the EDIT_STORY delta; applyOp merges it server-side and the gate is removed; the server broadcasts the merged op.
- The reframed case-5 tests (op-loop + ws + integration) assert merge / same-field-LWW / delete-race-rejection; all green.
- Full suite + typecheck + drift green; two-browser open-link path re-verified.
- No shipped-client/schema change.
- I can explain every line; build-log entry drafted (AI drafts, David signs off).

START BY (no code before the failing test): reframe the op-loop case-5 test to assert different-field MERGE + same-field LWW (RED against today's gate/replace), then implement the server merge + gate removal; then the sync-client delta unit test → implement the client delta; then the ws/integration reframes; then re-verify in the browser.
