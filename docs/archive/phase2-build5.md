BRIEF phase2-build5: live room cursors + coloured avatars

Fifth post-launch build, and the first net-new direction since the UAT backlog cleared
(build-state-after-phase2-build4.md: no queued cluster). Director's idea: in a shared room,
show every other participant's mouse pointer moving over the board so concurrent work does
not collide unseen, with each pointer coloured to match that person's avatar. Avatars get
colourised to anchor the match. This un-parks the MP5 "live cursors" item while keeping the
sealed-model discipline intact.

RoE cadence applies. PROPOSE was ruled in chat (David accepted all recommendations); the
ruled block is at the foot of this brief for the record. TDD where there is pure logic;
two-browser room UAT for the view/CSS. NO code before the rulings below; they are settled.

The session context that motivates it (director's framing): at the start of a planning
session attendees add detail to stories, so there is a lot of concurrent activity. Individuals
are asked to OWN a sprint and the stories booked in it for the session and fill in detail with
verbal guidance from the team. Ownership is a SPOKEN convention, not a feature (R4). Cursors
make the remaining clashes visible. We are deliberately keeping this small.

Read first (live source, not this summary):
- server/server.js — the ws upgrade builds meta = {roomId, identity, name, session, id}
  (id is a stable server-assigned per-connection id, the colour anchor); broadcastPresence is
  server-derived from the socket set; ws.on("message") IGNORES any non-op frame today
  (`if (msg.type !== "op") return;`); broadcast/leave. The colour assignment, the presence-
  payload colour, and the whole cursor relay live HERE.
- public/js/sync-client.js — the room store contract: onMessage handles state/op/nack/presence
  only; dispatch sends ops. This brief adds an onCursor callback and sendCursor/clearCursor
  methods (transport stays encapsulated, parallel to dispatch).
- public/js/main.js — the IN_ROOM boot fork, renderPresence (builds the chips, sets
  #room-live-count), the #board element + its delegated listeners, and the subscribe/paint
  loop. The cursor layer wiring, the throttled pointermove, and the avatar-colour application
  go here, all guarded by IN_ROOM.
- public/index.html + public/css/plan.css — the `.workspace` flex row [presence rail | board |
  backlog], `#board`, the `.presence-chip` / `.presence-initial` styles, AND the element that
  scrolls horizontally for a wide (3-month) plan. CONFIRM which element is the scroll container;
  the cursor coordinates normalise against THAT element (the maths is identical whichever it is).
- server/rooms.js — applyOp and the 10-op allow-list. Cursors must NOT be added here. Listed so
  the builder confirms it stays byte-for-byte untouched (the invariant, R1).

---

THE HEADLINE (the line this build holds)

This build adds NO new action, NO schema change, NO reducer change, NO server op-loop /
allow-list change, and NO persisted data. Cursors and participant colour are pure EPHEMERAL
presence: client view/CSS/wiring plus one new ephemeral ws frame relayed by the server, never
through applyOp and never committed. It un-parks the MP5 live-cursors item but the op loop, the
10-op allow-list, validatePlan, autosave, and the local single-user path are all untouched.

---

GOAL

In a shared planning room, every participant can see where the others are working on the board
in real time, each person's cursor and avatar sharing one colour, so concurrent detail-adding
(people owning sprints and the stories in them) does not collide unseen.

---

RULINGS (settled architecture — not up for PROPOSE)

- R1 EPHEMERAL SIDE-CHANNEL — THE HARD INVARIANT. Cursors and participant colour are ephemeral
  presence data. They NEVER pass through applyOp, reduce, validatePlan, or commitRoom; never
  touch room.doc or room.version; never persist to the db; never go through the op loop or the
  local autosave. No reducer / actions / schema / validatePlan change. The 10-op allow-list and
  the local single-user path are untouched. Asserted test: a cursor frame leaves room.version
  and room.doc unchanged and writes nothing to the db (see ASSERTED OUTCOMES).
- R2 ROOM MODE ONLY, ADDITIVE. Cursors and coloured avatars exist in a room and only in a room.
  The local single-user app is byte-for-byte unchanged: no cursor layer activity, no pointermove
  broadcast, no colour. All cursor wiring is guarded by IN_ROOM. Reuse the existing style
  vocabulary; amber/red stay reserved for capacity, so the cursor palette avoids them.
- R3 COLOUR IS SERVER-ASSIGNED AND COLLISION-FREE (P2 ruling). On connection the server assigns
  the lowest palette index not currently in use by a connected participant in that room, stored
  in meta.colour and added to each participant object in the presence payload. A leaver frees
  their colour for reuse. Both the avatar initial badge and that person's cursor read the one
  colour, so they match by construction. No client-side colour derivation, no hash collisions
  (clashes only if more than palette-size people are present at once, beyond a realistic team).
- R4 OWNERSHIP STAYS VERBAL (P1 ruling). Owning a sprint or its stories for the session is a
  facilitation convention spoken in the room. This build adds NO owner field, NO owner action,
  NO schema change. A persisted owner would be a schema bump + a new op + an allow-list entry,
  a separate brief if ever wanted.
- R5 CURSORS DECOUPLED FROM THE RENDER CYCLE. render() rebuilds the board via replaceChildren
  and re-wires dragula on every paint, so cursors live in their OWN overlay layer that render()
  never touches and the store never drives. The cursor layer is updated directly by the cursor
  message handler, outside the subscribe/paint loop. This keeps cursors off both the op loop and
  the paint loop, and guarantees they never become drop targets that disturb drag.

---

WHAT THIS BUILD BUILDS (per item)

### Coloured avatars (the foundation)

Today: renderPresence builds each chip with a plain initial badge; participants are
{id, name, identity}; the presence payload carries no colour.

Build:
- Server assigns meta.colour at connection from a fixed palette via a pure picker
  (pickColourIndex over the colours currently in use by the room's connected sockets; lowest
  free index, reused after a leave). The palette is a small set of saturated mid-dark hues, all
  chosen so WHITE text reads on them (no runtime contrast maths; amber/red excluded per R2).
- broadcastPresence adds `colour` to each participant object: {id, name, identity, colour}.
- renderPresence paints the `.presence-initial` badge background with p.colour. The
  verified/claimed vocabulary and the (guest) marker are unchanged (MP5 R3 still holds: a named
  open-link joiner still reads "Dave (guest)").

Pure seams: paletteColour(index) -> hex (wraps mod length); pickColourIndex(usedIndices,
paletteSize) -> lowest free index (wraps when all used). Both unit-tested.

### Live cursors (the headline)

Today: server's ws.on("message") returns early on any non-op frame; sync-client onMessage knows
only state/op/nack/presence; there is no way to send or receive a pointer position; the board
re-renders each paint.

Build:
- SERVER relay. Accept two ephemeral frames from a client: `{ type: "cursor", x, y }` (a
  position, x/y are normalised fractions) and `{ type: "cursor", gone: true }` (left the board).
  Stamp the sender's meta.id and fan out to the room EXCEPT the sender as
  `{ type: "cursor", id, x, y }` / `{ type: "cursor", id, gone: true }`. This branch NEVER calls
  applyOp, NEVER touches room.doc/room.version, NEVER commits (R1). Sender exclusion means no
  client ever receives its own cursor, so there is nothing to filter client-side.
- CLIENT transport (sync-client.js). Add an `onCursor(msg)` callback to createRoomStore opts
  (parallel to onPresence) and `sendCursor(x, y)` / `clearCursor()` methods on the returned room
  store (they call transport.send; the transport stays encapsulated). onMessage gains a `cursor`
  branch that forwards to onCursor. The local createStore is unchanged (main.js only calls these
  in room mode).
- CLIENT view (main.js, IN_ROOM only). A `#cursor-layer` overlay positioned over the board, NOT
  inside the re-rendered board DOM (R5). A throttled pointermove on the board scroll container
  computes normalised content-box coords and calls sendCursor; pointerleave calls clearCursor.
  The cursor handler upserts a coloured pointer + a small name label per remote id and removes
  it on `gone`. Colour is looked up from the latest presence snapshot by id (so cursor frames
  stay tiny and carry no colour). On every presence frame, reconcile the cursor layer against
  the participant list and drop any cursor whose id is no longer present (covers disconnects).
  The label shows the name only; the rail remains the source of truth for the guest marker.
- COORDINATES (P4 ruling). Normalise against the board's FULL scrollable content box plus each
  viewer's scroll offset, so cursors land on the correct board cell even when two viewers have
  scrolled the wide plan to different positions. Sender:
  fracX = (clientX - rectLeft + scrollLeft) / scrollWidth (fracY analogous). Receiver:
  px = fracX * scrollWidth - scrollLeft + rectLeft (py analogous). Pure helpers
  toBoardFraction(point, metrics) and fromBoardFraction(frac, metrics), metrics =
  {rectLeft, rectTop, scrollLeft, scrollTop, scrollWidth, scrollHeight}. NOTE: confirm the real
  scroll container in plan.css and read metrics from THAT element; the maths is identical
  whichever element scrolls.
- THROTTLE. Cap sends to roughly 30 per second (trailing throttle or rAF) so a fast mouse does
  not flood the socket. Fire-and-forget; the last position always sends.

Pure seams: toBoardFraction / fromBoardFraction (round-trip); reconcileCursors(activeIds,
presenceIds) -> ids to drop. Both unit-tested.

---

ASSERTED OUTCOMES (TDD where there is logic; two-browser room for view/CSS)

Unit (pure helpers, RED first — public/js/cursors.js):
- paletteColour: index 0 returns the first hue; index == length wraps to the first; every hue is
  a valid hex.
- pickColourIndex: empty used set -> 0; used {0,1} -> 2; used {0,2} -> 1 (lowest free); all
  indices used -> wraps to a valid index.
- toBoardFraction/fromBoardFraction: from(to(p, m), m) ~= p within epsilon for several points
  and several metric sets (different rect + scroll); a point at the content origin -> ~{0,0};
  the content bottom-right -> ~{1,1}; a point under a non-zero scroll still round-trips.
- reconcileCursors: cursors {a,b,c} vs presence {a,c} -> drop {b}; cursors {} -> drop {};
  presence superset -> drop {}.

Server invariant (the hard one, R1):
- Feeding a `{ type: "cursor", x, y }` frame through the room message path leaves room.version
  and room.doc byte-identical and performs NO db write (assert commitRoom is not called / the
  persisted version is unchanged). A cursor frame is fanned out to the OTHER sockets only, never
  echoed to the sender.

Browser (two-context room, the gate as in MP5/build4 — `node server/dev-rooms.js`, two browsers
in the demo room as Alice and Bob):
- Moving Alice's mouse over the board shows a coloured pointer labelled "Alice" in Bob's window,
  positioned over the SAME board cell; and vice versa.
- Each cursor's colour matches that person's avatar initial in the presence rail.
- A participant never sees their own drawn cursor (only the real OS pointer).
- Leaving the board (pointerleave) removes that cursor in the other window; closing a tab
  removes BOTH the avatar chip and the cursor.
- Independent scroll: with Alice scrolled to later sprints and Bob not, Alice's cursor still
  lands on the correct cell in Bob's view (validates content-box normalisation).
- Drag still works; the cursor layer never blocks a dragula drop target.
- Local mode (no `?room=`) shows no cursor layer and no avatar-colour change beyond what ships.

Regression: full suite + typecheck + drift green; the MP1 sync path and MP5 presence re-verified
in a two-client room (this build touches the room message path and renderPresence).

---

OUT OF SCOPE (parking lot — kept small on the director's call)

- Per-card "X is editing" indicators and drag ghosting (showing the card another user is
  dragging). MP5 parking lot, still parked.
- Cursors inside the card-editor modal or any modal.
- Backlog cursors (board-only this build, P3 ruling). An easy follow-on if wanted.
- Idle-timeout auto-hide; cursor smoothing / interpolation / animation; away / heartbeat.
- Touch-cursor rendering (a drawn cursor for a touch user is odd; render for mouse/pen only, or
  simply accept no cursor for touch).
- Persisted sprint/story ownership (R4 / P1 ruling).
- Cross-tab dedupe (still parked from MP5).
- Any path that lets a cursor or colour touch room.doc/room.version, the op loop, validatePlan,
  the allow-list, or persistence.

---

DEFINITION OF DONE

- Cursors and coloured avatars verified in a two-browser room against the asserted outcomes,
  INCLUDING the independent-scroll check; local mode unchanged.
- The pure seams (paletteColour, pickColourIndex, toBoardFraction/fromBoardFraction,
  reconcileCursors) have unit tests that assert real behaviour, RED first (reviewed for what
  they assert, not just that they pass).
- The hard invariant test is green: a cursor frame changes neither room.version nor room.doc and
  writes nothing to the db.
- No data-loss path; no shipped-model change (R1): no new action/schema/reducer/op-loop/
  allow-list change; no persisted data added.
- I can explain every line; build-log entry drafted (AI drafts, David signs off).
- Full suite + typecheck + drift green; MP1 + MP5 paths re-verified.

---

START BY (the rulings are settled): write the cursors.js pure-seam tests (RED) — paletteColour,
pickColourIndex, toBoardFraction/fromBoardFraction round-trip, reconcileCursors — then the server
colour assignment + presence-payload colour, then the server cursor relay + the ephemeral-
invariant test, then the sync-client onCursor + sendCursor/clearCursor, then the main.js cursor
layer + throttled pointermove + avatar colour + presence reconcile. Verify each in a two-browser
room. Restart dev-rooms.js after any server/*.js change (Node does not hot-reload).

Files (anticipated):
- New: public/js/cursors.js (pure: paletteColour, pickColourIndex, toBoardFraction,
  fromBoardFraction, reconcileCursors); tests/cursors.test.js; a server ephemeral-invariant test.
- Modified: server/server.js (meta.colour, presence-payload colour, cursor relay branch with
  sender-excluded fan-out), public/js/sync-client.js (onCursor + sendCursor/clearCursor + cursor
  onMessage branch), public/js/main.js (cursor layer + throttled pointermove + avatar colour +
  reconcile, all IN_ROOM), public/index.html (#cursor-layer over the board), public/css/plan.css
  (cursor pointer + label, coloured initial badge).
- Untouched (assert): server/rooms.js (applyOp + the 10-op allow-list), public/js/store.js,
  public/js/plan-io.js, the schema, the local single-user path.

---

PROPOSE — RULED IN CHAT (David accepted all recommendations; recorded here for the build-state)

P1. Scope. Cursors + coloured avatars only, fully ephemeral; sprint/story "ownership" stays a
    VERBAL session convention, not a persisted owner field. RULED: cursors-only (folded into R4).
P2. Colour source. Server-assigned palette, collision-free, carried in the presence payload (vs
    client-derived hash with clash risk). RULED: server-assigned (folded into R3).
P3. Cursor surface. Board grid only for v1 (vs whole workspace incl. backlog). RULED: board-only;
    backlog cursors parked.
P4. Coordinates. Normalise to the board's full scrollable content box + per-viewer scroll offset
    (vs visible-viewport-only, which misaligns under independent scroll). RULED: content-box.
P5. Packaging. One feature branch, one PR; brief phase2-build5.md. RULED: one branch/PR; build
    order as in START BY (director's call to vary).
