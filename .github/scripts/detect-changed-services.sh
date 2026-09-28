#!/usr/bin/env bash
# Detect which deployable services changed between two commits and emit a GitHub Actions matrix.
#
# Usage:
#   WORKFLOW=all BASE_SHA=<sha> HEAD_SHA=<sha> ./detect-changed-services.sh
#   WORKFLOW=app BASE_SHA=<sha> HEAD_SHA=<sha> ./detect-changed-services.sh
#   WORKFLOW=agent BASE_SHA=<sha> HEAD_SHA=<sha> ./detect-changed-services.sh
#
# An all-zero BASE_SHA (a new branch, or a manual "deploy everything") selects every service in
# the workflow. ONLY_SERVICES (comma-separated service names) selects exactly those services and
# ignores the diff.
#
# Outputs (GITHUB_OUTPUT):
#   any=true|false
#   matrix=[{service,dockerfile,image,webhook_env}, ...]

set -euo pipefail

workflow="${WORKFLOW:?WORKFLOW must be all, app or agent}"
base_sha="${BASE_SHA:?BASE_SHA is required}"
head_sha="${HEAD_SHA:?HEAD_SHA is required}"

node scripts/detect-pr-changes.mjs \
  --base "$base_sha" \
  --head "$head_sha" \
  --workflow "$workflow" \
  --only "${ONLY_SERVICES:-}" \
  --format gha-deploy
