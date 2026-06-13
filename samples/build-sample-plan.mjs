// build-sample-plan.mjs — regenerate the demo/UAT sample board.
//
// Builds a realistic ~3-month software-development plan with the REAL reducers,
// so the output is guaranteed to pass the Import board boundary
// (extractPlan → migratePlan → validatePlan). Every story lands in the BACKLOG
// (unplaced) so a presenter drags them into sprints live during a demo.
//
//   node samples/build-sample-plan.mjs
//
// Writes public/samples/sample-plan.json (served at /samples/sample-plan.json
// and importable from disk via the topbar "Import board" button).
//
// Settings: 3 months, 2-week sprints, velocity 20, 10% buffer → ~18 pts/sprint
// across ~6 sprints (~108 pts capacity). The backlog totals a bit more than
// that, so prioritisation is part of the demo. Points are Fibonacci (1/2/3/5/8).
import { createInitialState, reduce } from "../public/js/store.js";
import * as A from "../public/js/actions.js";
import { exportPlan } from "../public/js/plan-io.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let s = createInitialState("2026-07-06"); // a Monday
s = reduce(s, A.setDurationMonths(3));
s = reduce(s, A.setSprintWeeks(2));
s = reduce(s, A.setVelocity(20));
s = reduce(s, A.setBufferPct(10));
s = reduce(s, A.setPlanTitle("Sample: Customer portal rebuild (demo data)"));

function epic(title) { const a = A.addEpic({ title }); s = reduce(s, a); return a.payload.id; }
function story(epicId, title, points, summary) {
  s = reduce(s, A.addStory({ title, summary, points, epicId }));
}

// Each epic is a real slice of a SaaS web-app rebuild; each story carries a
// one-line summary (the "detail") and relevant points.
const auth = epic("Authentication & accounts");
story(auth, "Email + password sign-up", 3, "Registration form with validation, password hashing (argon2) and a verification email.");
story(auth, "Passwordless magic-link login", 5, "Issue a signed one-time link by email; consume it to start a session. Covers expiry and replay.");
story(auth, "OAuth sign-in (Google, Microsoft)", 5, "Add social login via OIDC, linking to existing accounts by verified email.");
story(auth, "Password reset flow", 2, "Request-reset email, tokenised reset page, and session invalidation on change.");
story(auth, "Account settings & profile", 3, "Let users edit name, avatar, email (with re-verification) and delete their account.");

const dash = epic("Customer dashboard");
story(dash, "Dashboard shell & navigation", 3, "Responsive app shell: sidebar, top bar, route skeletons and empty states.");
story(dash, "Overview widgets", 5, "Usage, recent activity and quick-action cards driven by the metrics API.");
story(dash, "Saved views & filters", 3, "Let users filter their data and persist named views per account.");
story(dash, "Dark mode & theming", 2, "Token-based theme with a system/dark/light toggle persisted per user.");

const billing = epic("Billing & subscriptions");
story(billing, "Stripe checkout integration", 8, "Create checkout sessions, handle success/cancel and store the customer id.");
story(billing, "Subscription plans & upgrades", 5, "Plan selection, proration on upgrade/downgrade and seat counts.");
story(billing, "Invoices & billing history", 3, "List past invoices with PDF download, pulled from Stripe.");
story(billing, "Dunning & failed payments", 5, "Retry schedule, in-app banners and email nudges on payment failure.");
story(billing, "Webhook processing", 3, "Verify and idempotently process Stripe webhooks (subscription + invoice events).");

const notif = epic("Notifications & messaging");
story(notif, "Transactional email service", 3, "Templated email sending via the provider with retries and a send log.");
story(notif, "In-app notification centre", 5, "Bell menu, unread counts and a notifications API with read/dismiss.");
story(notif, "User notification preferences", 2, "Per-channel, per-type opt-in/out stored against the account.");
story(notif, "Weekly digest email", 3, "Scheduled summary of account activity, respecting preferences.");

const admin = epic("Admin & back-office");
story(admin, "Admin user management", 5, "Search, view, disable and impersonate users; audit each action.");
story(admin, "Feature flags & rollout", 3, "Toggle features per environment and per cohort without a deploy.");
story(admin, "Audit log viewer", 3, "Searchable, filterable record of sensitive actions for support and compliance.");
story(admin, "Support impersonation guardrails", 2, "Time-boxed, logged impersonation with a visible banner and consent gate.");

const platform = epic("Platform, CI/CD & observability");
story(platform, "CI pipeline (lint, test, build)", 3, "Run lint, unit tests and a build on every PR; block merge on failure.");
story(platform, "Containerise & deploy", 5, "Dockerise the app and wire a staging + production deploy with rollback.");
story(platform, "Structured logging & tracing", 5, "Correlation ids, structured logs and request tracing across services.");
story(platform, "Error monitoring & alerts", 3, "Capture exceptions, group them and alert on new/spiking issues.");
story(platform, "Database migrations & backups", 3, "Versioned migrations in CI and automated, restored-tested backups.");

const search = epic("Search & reporting");
story(search, "Global search", 5, "Indexed search across accounts, records and docs with typeahead.");
story(search, "Exportable reports (CSV)", 3, "Build and download filtered CSV reports of account data.");
story(search, "Scheduled report emails", 3, "Let users schedule a saved report to arrive by email.");

const onboard = epic("Onboarding & UX polish");
story(onboard, "First-run onboarding checklist", 3, "A guided checklist that tracks setup steps and celebrates completion.");
story(onboard, "Empty-state illustrations & copy", 2, "Helpful, on-brand empty states across the main screens.");
story(onboard, "Keyboard shortcuts & a11y pass", 3, "Add shortcuts and fix the worst accessibility gaps (focus, labels, contrast).");
story(onboard, "Performance budget & polish", 5, "Set a performance budget and fix the largest bundle and render regressions.");

const out = exportPlan(s, "2026-06-13T12:00:00.000Z");
const totalPts = Object.values(s.stories).reduce((n, st) => n + st.points, 0);

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "..", "public", "samples", "sample-plan.json");
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");

console.log(
  `wrote ${dest}\n  epics=${Object.keys(s.epics).length} stories=${Object.keys(s.stories).length} ` +
  `backlog=${s.backlog.length} totalPts=${totalPts} sprints=${s.sprints.length}`
);
