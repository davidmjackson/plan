BRIEF MP4: Productionise slice 4 — the collaborate bridge (create a room from the current plan + share link)

(Fourth productionise slice. One slice, RoE cadence, TDD, branch `feat-mp4-collab-bridge` off main. main now carries MP1–MP3.)

Read first: docs/phase2-mp1-client-sync-brief.md (the room store/dual-mode), docs/phase2-mp2-company-auth-brief.md (POST /rooms + the auth provider — this slice extends both), public/js/main.js (the dual-mode boot fork + the topbar control wiring this slice adds to), public/js/modal.js (openModal — reuse for the create dialog), server/server.js (POST /rooms — gains an optional initial plan).

DIRECTOR RULINGS ON SCOPE (decided this session)
- COLLABORATION REQUIRES AN ACCOUNT. Creating a room needs an authed manager (the MP2 requireAuth gate stands). The create UI is built and TESTED AGAINST THE STUB now; real use goes live when the hub deploys (slice 5). The anonymous local single-user app is unchanged; collaborating means launching plan from the hub first.
- THIN FIRST — THE BRIDGE ONLY. This slice = create-room UI (blend-mode picker) + the share link + "import my current plan into the room". PRESENCE (who's here) is a SEPARATE follow-on slice, not built here.

GOAL
Give a user a UI path from a plan to a live shared room: pick a blend mode, create the room seeded with the CURRENT plan, and get a share link — instead of hand-crafting a `?room=&token=` URL. Build it against the stub auth so it is fully testable now; it activates for real when the hub is live.

RULINGS (R1–R5)
- R1 IMPORT = SEED THE ROOM WITH THE CURRENT PLAN. POST /rooms accepts an optional `plan` in the body; the server validates it with the EXISTING validatePlan (a structurally bad plan → 400, the room is not created) and seeds the room's authoritative doc with it. Absent a plan, it seeds an empty createInitialState as today. The plan's transient `lastReturnedStoryIds` is normalised to [] at the boundary.
- R2 THE COMPANY STILL COMES FROM THE SESSION. Unchanged from MP2: the room's companyId is the manager's session company, never the body. The body supplies only `mode` and the optional `plan`.
- R3 REUSE THE EXISTING UI VOCABULARY. The create dialog uses modal.js (openModal), the existing `.btn`/`.btn-pri` classes, and a topbar control in the established group pattern (like Export/Download). No new design language; match plan.css. The blend-mode picker is a simple two-option control (Open link · anyone with the link / Company only · signed-in members).
- R4 GRACEFUL WHEN UNAUTHED. The "Collaborate" control is shown; clicking POSTs to /rooms. A 401 (no session — the common case until the hub is live) surfaces a clear toast ("Sign in via Sprint Suite to start a shared room"), never a crash. With the stub/real session present, it creates the room.
- R5 NO SHIPPED-MODEL CHANGE. The single-user local path, the reducer/actions/schema/validatePlan, and the MP1/MP2/MP3 behaviour are untouched. This slice adds a client control + a small server seed-from-plan option only.

WHAT THIS SLICE BUILDS
1. `server/server.js` — POST /rooms accepts `{ mode, plan? }`: when `plan` is present, `validatePlan(plan)` (400 on failure), seed the room doc with the normalised plan; else createInitialState. companyId from the session (R2).
2. `public/js/collaborate.js` (or a focused addition to main.js) — a "Collaborate / Share live" topbar control that opens a create dialog (blend-mode picker), POSTs `{ mode, plan: store.getState() }`, and on success shows the share link with a copy button + an "Open room" action that navigates to `?room=<id>&token=<token>`. 401 → toast (R4).
3. main.js — wire the control (local mode only; in a room the control is hidden/disabled — you are already collaborating).

ASSERTED OUTCOMES (TDD)
- server: POST /rooms with a valid `plan` body → room created, its persisted doc equals the imported plan (companyId from session, R2). POST with a structurally INVALID plan → 400, no room created. POST with no plan → empty createInitialState room (regression).
- server: the imported plan's `lastReturnedStoryIds` is normalised to [] (R1).
- client (unit, where logic is extractable): the create request carries the current plan + chosen mode; a 401 response yields the unauthed toast path, a success yields the share link/navigation.
- browser: from a stub-authed session, create an open-link room seeded with a populated board → the share link works → opening it in a second context shows the SAME board (the import round-trips); the local single-user app with no session shows the unauthed toast on create.
- regression: full suite + typecheck + drift green; MP1 two-browser path still works.

OUT OF SCOPE (parking lot)
- Presence / who's-here / cursors (the next slice).
- systemd deploy, the live cross-origin static→service wiring, the hub registration (slice 5; the create UI is same-origin via the node server in dev/test).
- Company-only creation verified against a real hub (stub now; real at slice 5).
- Reconnect/resume polish, optimistic echo.
- Any shipped reducer/actions/schema/validatePlan/card-editor change.

DEFINITION OF DONE
- POST /rooms seeds from an optional validated plan; the create UI (blend picker + share link + import) works against the stub; 401 is handled gracefully.
- Asserted server + client outcomes green; full suite + typecheck + drift green; MP1 path re-verified.
- The import round-trip verified in the browser (create-from-populated-board → open share link → same board).
- No shipped-model change; the anonymous local app is unchanged.
- I can explain every line; build-log entry drafted (AI drafts, David signs off).

START BY (no UI before the failing test): write the server test for POST /rooms seeding from a valid/invalid/absent plan (RED), implement the seed-from-plan option, then build the collaborate control + dialog and verify the import round-trip in the browser.
