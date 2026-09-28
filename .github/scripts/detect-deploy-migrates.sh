#!/usr/bin/env bash
# Decide whether Production Deployment will apply production migrations for this push.
#
# Production Deployment migrates before it publishes, but only when it has a service to publish.
# When it does, Database Migrations must stand down so the `prisma-migrate-production` group never
# holds more than two contenders; a third makes GitHub cancel a queued job outright.
#
# The answer comes from `detect-changed-services.sh`, the same script the deploy workflow runs. The
# deploy workflow diffs against its last successful run rather than this push's `before` SHA, so it
# can find more services than this check does, never fewer: when this reports false, the deploy may
# still migrate, which keeps the contenders at two.
#
# Usage:
#   BASE_SHA=<sha> HEAD_SHA=<sha> ./detect-deploy-migrates.sh
#
# Outputs (GITHUB_OUTPUT):
#   deploy_migrates=true|false

set -euo pipefail

base_sha="${BASE_SHA:?BASE_SHA is required}"
head_sha="${HEAD_SHA:?HEAD_SHA is required}"
output="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

detected="$(mktemp)"
trap 'rm -f "$detected"' EXIT

WORKFLOW=all \
  BASE_SHA="$base_sha" \
  HEAD_SHA="$head_sha" \
  GITHUB_OUTPUT="$detected" \
  bash .github/scripts/detect-changed-services.sh >/dev/null

if grep -qx 'any=true' "$detected"; then
  echo "Production Deployment has services to publish, so it will migrate."
  echo "deploy_migrates=true" >>"$output"
  exit 0
fi

echo "Production Deployment will not migrate for this push."
echo "deploy_migrates=false" >>"$output"
