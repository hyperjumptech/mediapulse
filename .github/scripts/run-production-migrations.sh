#!/usr/bin/env bash
# Apply production database migrations for all Prisma schemas and DataQueue.
#
# Required secrets/env (production CI):
#   ORCHESTRATION_DATABASE_URL
#   MEDIAPULSE_DATABASE_URL
#   PG_DATAQUEUE_DATABASE (optional; skips DataQueue when unset)

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

echo "Migrating orchestration database…"
pnpm --filter=@hermes/orchestration-database run db:migrate:deploy

echo "Migrating mediapulse database…"
pnpm --filter=@mediapulse/database run db:migrate:deploy

if [ -n "${PG_DATAQUEUE_DATABASE:-}" ]; then
  echo "Migrating DataQueue schema…"
  pnpm --filter=@hermes/worker run migrate-dataqueue
else
  echo "PG_DATAQUEUE_DATABASE unset — skipping DataQueue migration."
fi

echo "Production database migrations complete."
