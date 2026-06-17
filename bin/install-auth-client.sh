#!/usr/bin/env bash
#
# install-auth-client.sh — restore the deploy-time @suite/auth-client dependency.
#
# Why this exists:
#   @suite/auth-client is intentionally NOT in package.json. It is a private
#   suite package (it lives in the suite monorepo), and plan's repo is PUBLIC —
#   committing it, or a `file:` path to it, would either expose private auth
#   code or break `npm ci` for public clones and CI. CI and public clones run
#   the STUB auth provider (no HUB_BASE_URL) and never import it, so only the
#   live box needs it.
#
#   On the box it is installed with --no-save, which means a plain `npm ci`
#   SILENTLY DROPS it and breaks the real auth provider. Run this script AFTER
#   every `npm ci` / `npm install` on the live box to restore it.
#
#   Idempotent — safe to re-run.
#
# NOTE: This is a LIVE-BOX step. Do not run it on a machine where you also run
#   the test suite: tests/mp2-company-auth.test.js asserts the real-auth path
#   REJECTS when @suite/auth-client is absent, so installing it here makes that
#   test fail by design. The box does not run the tests.
#
# Usage:
#   bin/install-auth-client.sh
#   SUITE_AUTH_CLIENT=/path/to/auth-client bin/install-auth-client.sh
#
set -euo pipefail

SRC="${SUITE_AUTH_CLIENT:-/var/www/suite/shared/auth-client}"
PLAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$SRC" ]; then
  echo "ERROR: @suite/auth-client source not found at: $SRC" >&2
  echo "       This script is for the live box, where the suite repo is present." >&2
  echo "       Set SUITE_AUTH_CLIENT to its path if it lives elsewhere." >&2
  exit 1
fi

cd "$PLAN_DIR"

echo "Installing @suite/auth-client from $SRC (--no-save, into $PLAN_DIR/node_modules)..."
npm install --no-save "$SRC"

echo "Verifying the package resolves and exports createAuthClient..."
node -e "import('@suite/auth-client').then(m => { if (typeof m.createAuthClient !== 'function') { console.error('FAIL: createAuthClient is not a function'); process.exit(1); } console.log('OK: @suite/auth-client resolves; createAuthClient is a function'); }).catch(e => { console.error('FAIL: could not import @suite/auth-client:', e.message); process.exit(1); });"

echo "Done. Restart the rooms service to pick it up: sudo systemctl restart sprintplan-rooms"
