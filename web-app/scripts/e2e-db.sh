#!/usr/bin/env bash
set -euo pipefail

# Rebuild a dedicated database for the E2E run. This script receives the
# environment prepared by playwright.config.ts (TURSO_DATABASE_URL, seed vars).
#
# `npx` is used instead of a relative node_modules path because this repo is an
# npm workspace: binaries are hoisted to the monorepo root, not web-app/.
rm -f e2e.db e2e.db-shm e2e.db-wal
npx tsx src/db/migrate.ts
npx tsx src/db/seed.ts
