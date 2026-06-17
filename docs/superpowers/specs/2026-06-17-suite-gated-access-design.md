# Design — Suite-gated access (Phase 3)

**Date:** 2026-06-17
**Status:** Approved (brainstorming complete; pending implementation plan)
**Author:** Claude Code (Opus 4.8) under David's direction

## Summary

Retire the free, sign-in-free direct-visit board. After this phase:

- **Single-user access requires a Sprint Suite session.** Opening `sprintplan.uk/` with no share link and no session redirects to the Sprint Suite to log in / launch plan.
- **Multi-user collaboration works via a shared link** created by a logged-in suite user — link-holders join as ephemeral guests with no account (this path largely exists today via `open-link` rooms).
- A **logout button** sends suite users back to the suite **dashboard**, and guests (via a modal) to the suite **landing page**, wiping the guest's ephemeral identity.

This is an **access shell around the existing app**. The board, reducer, schema, sync-client, and `decideUpgrade` are **not touched**. Same reuse-by-composition discipline as the Phase 2 multiplayer work.

## Product reversal (explicit)

This **reverses** the Brief 10 / Phase 2 dual-mode ruling that "visiting sprintplan.uk directly is the free anonymous single-user app." It also makes the README's "free, no account, sign-in-free" positioning stale — those docs/copy must be updated as part of the work. The change is deliberate: funnel all access through the suite.

## Threat model (why the gate is client-side)

The entry gate is a **product funnel, not a data-security boundary**:

- Single-user data lives in the browser's **`localStorage`** — there is nothing server-side to protect.
- The source is **public AGPL** — the app shell is not a secret.
- The genuinely sensitive resource, **collaborative rooms**, is **already server-gated** by `decideUpgrade` (company-only requires a same-company session; open-link requires the share token).

A client-side gate therefore matches what is actually being protected. A determined user could run the local app offline; that is accepted. (A server-side hard gate remains a clean future option if the product later requires it.)

## Decisions (locked during brainstorming)

1. **Entry gate destination:** unauthenticated + no room link → **redirect to Sprint Suite** (hub login/launch).
2. **Guest session model:** guests stay **sessionless server-side**; identity is **ephemeral** (`sessionStorage`/memory), **auto-wiped on tab/browser close**. Logout clears it, shows a modal, → suite landing.
3. **Single-user data:** stays in **`localStorage`** — gate access only, **no migration, no server persistence.**
4. **Gate enforcement:** **client-side** boot check, room-links bypass it, `/auth/whoami` decides the rest, a full-screen overlay prevents any board flash.
5. **Room modes:** keep **both** `open-link` (guest-share path) and `company-only` (internal team rooms). `decideUpgrade` unchanged.
6. **Stranded anonymous `localStorage`:** **accepted**, no migration (tiny pre-launch user base).

## Access & boot flow

A new `auth-gate` runs on boot, before the board renders, behind a full-screen overlay:

```
On load:
├─ URL has ?room=…  ─────────────►  ROOM PATH (guest or suite user)
│                                    • existing flow: name-gate → ws connect
│                                    • server's decideUpgrade enforces the token
│                                    • suite session → "verified"; none → "claimed" guest
│                                    • NO suite login required (link possession is the gate)
│
└─ no ?room=  ──►  call /auth/whoami
                   ├─ authed  ──►  SINGLE-USER PATH
                   │                • render existing localStorage board (unchanged)
                   │                • show logout button (suite-user variant)
                   │
                   └─ not authed ─► REDIRECT to Sprint Suite (hub launch/login)
                                    • overlay stays up; board never renders
```

**Fail closed:** if `/auth/whoami` errors (network/hub down), keep the overlay and offer "Go to Sprint Suite" — never expose the board.

## Logout & the two exit paths

A single header **Log out** button; behaviour branches on **"do you hold a real suite session?"** (cached from boot `whoami`), not on whether you are in a room.

```
Click "Log out"
├─ Suite user (real session)
│     • call /auth/logout  → clears the plan_session cookie server-side
│     • redirect → Sprint Suite DASHBOARD
│     • (no modal)
│
└─ Guest (link-joiner, "claimed", no session)
      • leave the room (close ws) + WIPE ephemeral identity (sessionStorage cleared)
      • show MODAL "You've logged out" (informational)
      • on dismiss → redirect → Sprint Suite LANDING page
```

- **Tab/browser close for a guest** = the same wipe, for free (identity is `sessionStorage`/memory only); no modal — close is close.
- Guest logout does **not** delete their contributions to the shared board — those stay in `rooms.db`. Logout wipes *their* access/identity, not the room.

## Components & files

New, single-purpose modules (pure decision split from DOM/network for testability):

| File | Responsibility |
|------|----------------|
| `public/js/auth-gate.js` | Pure `decideEntry({ hasRoomLink, session })` → `"room" \| "single-user" \| "redirect"`, plus boot glue: call `/auth/whoami`, manage overlay, act on the decision. |
| `public/js/logout.js` | Logout button wiring + pure `decideLogout({ hasSuiteSession })` → `{ action, destination }`; the guest "You've logged out" modal (reuses `openModal`). |
| `public/js/suite-urls.js` | Config: `dashboardUrl()` / `landingUrl()` / `launchUrl()` derived from the suite origin. Single source of truth. |

Touched:
- `public/js/main.js` — run `auth-gate` first (top-level await, like the existing name-gate); wire the logout button; move guest identity storage (via `room-join.js`) to `sessionStorage` so close wipes it.
- `index.html` — add the header **Log out** button and the boot **overlay** element.
- **Server: no change expected.** `/auth/whoami` and `/auth/logout` already exist (real provider). The client calls logout then does its own redirect. *Verify-step:* if `handleLogout` force-redirects to a fixed target, adapt the client accordingly.
- **Docs:** update README ("Status" / "free, no account" copy) to reflect suite-gated access.

## Error handling & edge cases

- **`whoami` network error** → fail closed (overlay + "Go to Sprint Suite").
- **Expired/invalid session** → `whoami` reports not-authed → redirect (same as never-logged-in).
- **Invalid/bad room token** → unchanged: server 403 "Bad Token"; existing room-error handling.
- **Suite user opens a room link** → joins "verified" (existing); logout still = suite-user path (dashboard).
- **`/auth/logout` fixed redirect** → verify during build; client honours/overrides to the right destination.
- **Stranded anonymous `localStorage`** → accepted, no migration; flagged as a conscious call.

## Testing

Matches the project's `node --test` + theme-drift discipline; existing 233 tests stay green; `decideUpgrade` tests unchanged.

- **Unit (pure, no DOM):**
  - `decideEntry({ hasRoomLink, session })` across all branches.
  - `decideLogout({ hasSuiteSession })` → destination.
  - Guest-identity wipe clears `sessionStorage`.
- **Integration:**
  - `whoami`-authed → board renders, logout button present.
  - `whoami`-unauthed + no link → redirect invoked (assert target, no board).
  - Room link + no session → guest join unaffected.
- **In-app (Playwright headless, per the assert-visual-state rule):**
  - Overlay shows then board (authed).
  - Guest logout → modal → landing.
  - Suite logout → dashboard.
  - Assert visibility, not just DOM presence.

## Out of scope (YAGNI)

- Server-backed per-account single-user persistence (cross-device) — a separate future phase.
- Real ephemeral guest server sessions / expiry — link-possession already gates.
- Server-side hard entry gate (apache/node) — future option if the product needs a true boundary.
- Migration of stranded anonymous localStorage.
