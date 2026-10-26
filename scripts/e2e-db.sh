#!/usr/bin/env bash
set -euo pipefail

# Rebuild a dedicated database for the E2E run. This script receives the
# environment prepared by playwright.config.ts (TURSO_DATABASE_URL, seed vars).
rm -f e2e.db e2e.db-shm e2e.db-wal
node_modules/.bin/tsx src/db/migrate.ts
node_modules/.bin/tsx src/db/seed.ts
