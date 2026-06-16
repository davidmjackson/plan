BRIEF phase2-build4: collaboration polish (room chrome)

Fourth post-launch build. The remaining cluster from the post-launch UAT session: four
room-mode chrome items. RoE cadence applies (PROPOSE before any feature code; one feature
branch off main). TDD where there is pure logic; browser UAT for view/CSS. This brief opens
with firm rulings where the architecture is already settled, and ends with a PROPOSE block
for the genuinely open decisions. NO code before David rules on PROPOSE.

The four UAT items (build-state-after-phase2-build3.md):
- #3 mandatory name-on-join gate (joiners currently land as the literal name "guest")
- #1 re-open the share link after first use (the link only lives in the create-room modal)
- #10 a show-piece room name on the board
- #2 move presence off the topbar into a left rail

Read first (live source, not this summary):
- public/js/main.js — the dual-mode boot fork (the `?room=` path, the synchronous top-level
  store creation, renderPresence, the toast helper, the load-time gate). #3 restructures the
  room boot; #1/#2/#10 hang off this wiring.
- public/js/collaborate.js — the create-room dialog and showShareLink (the link lives ONLY in
  this modal today; #1 surfaces it from inside a room).
- public/js/sync-client.js — the room store contract (getState/dispatch/subscribe + onPresence).
- server/server.js — the ws upgrade (reads `name`, defaults "guest"), decideUpgrade, the
  presence broadcast. Confirms #3 needs no server change if the client guarantees a real name.
- public/js/render.js + public/index.html + public/css/plan.css — the board/header/workspace
  layout and the `.presence` chip styles (#2 relocates these; #10 adds a room header treatment).
- public/js/modal.js — openModal (Escape + overlay-click always close). #3's gate must be
  non-dismissable, so this shell needs an opt-in change or a bespoke overlay.

---

THE HEADLINE (the line this build holds)

The recommended path adds NO new action, NO schema change, NO reducer change, and NO server
op-loop change. If #10 takes option (a), it also adds NO server-data change. That keeps the
Phase 2 sealed-model discipline (R2) running through a FOURTH build: every item here is
client view/CSS/wiring over the existing room store, presence side-channel, and share-link
machinery. Option (b) for #10 is the only path that would break the no-server-data streak;
it is called out explicitly so the trade is David's, not an accident.

---

GOAL

Make a live room legible and joinable for a screen-shared planning session: everyone has a
real name, the host can re-surface the invite link at any time, the room is clearly named on
the board, and presence reads as a calm left rail rather than topbar clutter.

---

RULINGS (settled architecture — these are not up for PROPOSE)

- R1 SEALED MODEL. No reducer/actions/schema/validatePlan change; the op loop and the local
  single-user path are untouched. Presence stays a side-channel (MP5 R2): never reduced into
  the plan document, never through applyOp.
- R2 THE CLAIMED/VERIFIED MARKER STAYS. #3 replaces the joiner's NAME (no more literal
  "guest"); it does NOT remove the guest MARKER. Identity is still "verified" (authed company
  member) vs "claimed" (open-link, self-asserted), exactly as decideUpgrade computes. So a
  named open-link joiner reads "Dave (guest)", never "Dave" alone, and never "guest (guest)".
  The marker is about identity, not name (MP5 R3, the standing access ruling).
- R3 ROOM MODE ONLY, ADDITIVE UI. Every item shows in a room and only in a room. The local
  single-user app is byte-for-byte unchanged: no gate, no rail, no room header, no invite
  button. Reuse the existing style vocabulary (plum interaction accent; amber/red stay
  reserved for capacity); no new design language.
- R4 NO NEW DATA REACHES THE SERVER VIA UNTRUSTED INPUT. The room scope/company binding stays
  manager-session-derived (MP2). The name remains self-asserted for open-link joiners (that is
  what the guest marker exists for); the gate is a UX guarantee, not a security boundary.

---

WHAT THIS BUILD BUILDS (per item)

### #3 mandatory name-on-join gate

Root cause (grounded): showShareLink builds the invite as `?room=...&token=...` with NO name
param. main.js reads `roomParams.get("name") ?? "guest"`; server.js reads the same and
defaults "guest". So anyone arriving via a share link (joiner) or via the dialog's "Open room"
(creator) lands as the literal name "guest".

Build: a blocking, non-dismissable name prompt that runs in room mode BEFORE the socket opens,
whenever the effective name is blank or the sentinel "guest". On submit, the real name is put
into the room params and the ws URL is built from them (so the server records it); the page URL
is updated via history.replaceState so a refresh keeps the name. A pure helper
`resolveJoinName(rawNameParam)` decides {name, needsPrompt} (trim; ""/"guest" => needsPrompt)
and is the unit-tested seam. The prompt must not be escapable (no Escape, no backdrop-close, no
Cancel; submit disabled until a non-empty trimmed name).

Because the prompt is async and the room store is created synchronously at module top level
today, the room boot must wait for the resolved name. See PROPOSE P1 for the mechanism
(top-level await vs an extracted init) and P2 for the non-dismissable modal mechanism.

### #1 re-open the share link after first use

Root cause: the invite link exists only inside the create-room modal (showShareLink); once it
closes there is no way back, and inside a room the Collaborate button is hidden. The host who
clicks "Open room" loses the link the moment they enter their own room.

Build: a room-mode control that opens a small modal showing the CURRENT room's invite link with
Copy + Open actions. The client reconstructs the invite from its own params (no server round
trip, no new state): `${origin}/?room=<room>` plus `&token=<token>` when a token is present,
with the joiner's personal `name` (and any other personal params) STRIPPED so each invitee sets
their own name (and #3 gates them). Token-present => open-link-style link; token-absent =>
company-only link. See PROPOSE P3 for where the control lives.

### #10 show-piece room name on the board

There is no human room name in the model today (a room has an id and a shareToken). The plan
title (state.meta.title) is the only human label, shown as the band h1.

Recommended build (option a, no new data): in room mode, elevate the existing plan title into a
"live room" header treatment on the board: swap the band eyebrow to read as a live room, add a
LIVE indicator, and show the participant count (already available from the presence list). This
delivers a named room on the board using the plan title as the room name, with zero server/db
change. See PROPOSE P4 for option (a) vs (b) named/persisted rooms, and P5 for the in-room
title-edit wart (SET_PLAN_TITLE is not allow-listed, so editing the h1 in a room nacks today;
promoting it to the room name argues for making it read-only in room mode).

### #2 move presence to a left rail

Today `#presence` sits in the topbar (renderPresence in main.js; `.presence` chips in
plan.css), shown only in room mode.

Build: a vertical left rail inside `.workspace` (the current flex row of board + backlog),
shown in room mode only and hidden in local mode. renderPresence targets the rail host and the
chips stack vertically (reusing the existing chip vocabulary, including the guest marker).
Moving presence off the topbar also frees topbar/header room for the #1 invite control and the
#10 LIVE indicator (the items are complementary, which is part of why they cluster). The rail
must not disturb the board/backlog dragula drop targets. See PROPOSE P6 for rail placement.

---

ASSERTED OUTCOMES (TDD where there is logic; browser for view/CSS)

Unit (pure helpers, RED first):
- resolveJoinName: "" => needsPrompt true; "guest" => needsPrompt true; "  Dave  " => name
  "Dave", needsPrompt false; a normal name passes through trimmed.
- the invite-URL builder: given origin + room + token, returns `…/?room=R&token=T`; given no
  token, returns `…/?room=R`; a `name` param in the source is always stripped.

Browser (two-context room is the gate, as in MP5/build3):
- #3: opening a share link with no name shows the blocking gate; it cannot be dismissed by
  Escape, backdrop, or Cancel; on submit the participant appears in presence with the entered
  name plus the (guest) marker for an open-link join; a refresh keeps the name. The creator
  hitting "Open room" is gated the same way (per PROPOSE P1 ruling).
- #1: inside a room the host opens the invite control, sees the reconstructed link (token
  present for an open-link room), Copy works, the link carries no personal name; a second
  browser opening it lands at the #3 gate.
- #10: in a room the board shows the live-room treatment with the plan title as the room name,
  a LIVE indicator, and the participant count; local mode shows none of it.
- #2: presence renders as a left rail in a room, hidden in local mode; chips keep the
  verified/guest distinction; board + backlog drag still works.

Regression: full suite + typecheck + drift green; the MP1 sync path and MP5 presence
re-verified in a two-client room (the #3 boot restructure and the #2 host move both touch the
room path).

---

OUT OF SCOPE (parking lot)

- Server-side name enforcement / rejecting a blank or "guest" name at the upgrade (the gate is
  client-side UX; the threat model for open-link is link-possession + the guest marker).
- Live cursors / per-card "X is editing" indicators / avatars beyond initials (MP5 parking lot,
  still parked).
- User-level dedupe across tabs; presence heartbeats / idle / away.
- Persisted named rooms IF David picks #10 option (a); editable room name; renaming a live room.
- Any shipped reducer/actions/schema/validatePlan or server op-loop change.

---

DEFINITION OF DONE

- Each item verified in a two-browser room against the asserted outcomes; local mode unchanged.
- The two pure helpers have unit tests that assert real behaviour (reviewed for what they
  assert, not just that they pass).
- No data-loss path; no shipped-model change (R1); the headline holds (no new action/schema/
  reducer/op-loop change; no server-data change unless #10 option (b) is chosen).
- I can explain every line; build-log entry drafted (AI drafts, David signs off).
- Full suite + typecheck + drift green; MP1 + MP5 paths re-verified.

START BY (after PROPOSE is ruled): write the resolveJoinName + invite-URL unit tests (RED),
then the #3 boot restructure + gate, then #1 invite control, #10 header treatment, #2 rail;
verify each in a two-browser room.

---

PROPOSE (open decisions — David rules before any feature code)

P1. Room-boot mechanism for the #3 gate. The room store is created synchronously at module top
    level today; a mandatory name prompt is async and must precede the socket. Recommended:
    a top-level `await` on the gate before the `createRoomStore` line (smallest diff; the local
    path has no await and stays byte-for-byte identical; module evaluation pauses behind the
    gate overlay). Alternative: extract the post-store boot into an `init(store)` called
    immediately for local and after the gate for room (larger, more explicit diff).
    Recommendation: top-level await.

P2. Non-dismissable modal mechanism for #3. openModal always wires Escape + overlay-click to
    close. Recommended: add an opt-in `dismissable` option to openModal (default true, so every
    existing caller is unchanged; the gate passes false). Alternative: a bespoke blocking
    overlay that does not use the shared shell. Recommendation: the dismissable flag (reusable,
    one small additive change to the shared shell).

P3. Where the #1 invite control lives. Recommended: repurpose the hidden Collaborate button's
    slot into an in-room "Share link" / "Invite" button (in local mode it still opens the
    create dialog; in a room it opens the reconstructed-link modal). Alternative: a separate new
    button shown only in room mode. Recommendation: repurpose the slot.

P4. #10 scope. Option (a) NO new data: elevate the plan title as the room name in a room-mode
    header treatment + LIVE indicator + participant count (recommended; holds the no-server-data
    streak). Option (b) persisted named rooms: collect a room name in the create dialog, add a
    name column to the rooms table, accept it on POST /rooms, broadcast it in the state frame,
    render it. Option (b) is the first server-data change in the Phase 2 arc and is more work.
    Recommendation: option (a).

P5. In-room title editing (rides with #10). SET_PLAN_TITLE is not in the room op allow-list, so
    editing the band h1 in a room nacks today (a confusing "action not available" toast).
    Recommended: when promoting the title to the room name, set the h1 non-editable in room mode
    (contenteditable=false when IN_ROOM) so the room name does not invite a rejected edit. Pure
    view, no model change. Alternative: leave it editable and accept the nack. Recommendation:
    non-editable in room mode.

P6. #2 rail placement. Recommended: a vertical left rail inside `.workspace`, so layout becomes
    [presence rail | board | backlog], rail hidden in local mode. Alternative: a fixed-position
    rail overlay pinned to the viewport edge. Recommendation: inside `.workspace` (flows with
    the page, no overlap with drag targets).

P7. Packaging + order. Recommended: one brief, one feature branch, one PR covering all four
    items as independent slices (mirrors the phase2-build3 #7/#8/#9 ruling), suggested build
    order #3 -> #1 -> #10 -> #2. Alternative: split into smaller PRs. Recommendation: one
    branch/PR; order is the director's call.
