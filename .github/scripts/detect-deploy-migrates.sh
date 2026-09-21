#!/usr/bin/env bash
# Decide whether App Deployment or Agent Deployment will apply production migrations for this push.
#
# Both deploy workflows migrate before they publish, but only when they have a service to publish.
# When either of them does, Database Migrations must stand down: all three migrate jobs share one
# concurrency group, and a third contender makes GitHub cancel a queued one outright.
#
# The answer comes from `detect-changed-services.sh`, the same script the deploy workflows run, so
# the two can never disagree about what counts as a changed service. When no deploy workflow will
# migrate, this reports false and Database Migrations does the work itself.
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

for workflow in app agent; do
  : >"$detected"
  WORKFLOW="$workflow" \
    BASE_SHA="$base_sha" \
    HEAD_SHA="$head_sha" \
    GITHUB_OUTPUT="$detected" \
    bash .github/scripts/detect-changed-services.sh >/dev/null

  if grep -qx 'any=true' "$detected"; then
    echo "$workflow deployment has services to publish, so it will migrate."
    echo "deploy_migrates=true" >>"$output"
    exit 0
  fi
done

echo "No deploy workflow will migrate for this push."
echo "deploy_migrates=false" >>"$output"
