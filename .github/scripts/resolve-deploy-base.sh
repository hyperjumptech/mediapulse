#!/usr/bin/env bash
# Choose the commit a production deploy diffs against to decide which services changed.
#
# The base is the head of the last successful Production Deployment run on main, not the push's
# `before` SHA. A run that failed, or that GitHub cancelled while it waited in the concurrency
# queue, therefore does not lose its services: the next successful run redeploys everything that
# changed since the last good deploy.
#
# Falls back to the push's `before` SHA when there is no earlier success (for example the first
# run of this workflow) or when that commit is no longer an ancestor of HEAD. A manual run with
# `deploy_all` returns the empty-tree SHA, which the detector treats as "every service".
#
# Required env:
#   GH_TOKEN, GITHUB_REPOSITORY, HEAD_SHA
# Optional env:
#   EVENT_BEFORE   Push `before` SHA
#   DEPLOY_ALL     "true" to deploy every service
#
# Outputs (GITHUB_OUTPUT):
#   base_sha

set -euo pipefail

head_sha="${HEAD_SHA:?HEAD_SHA is required}"
repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
output="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
event_before="${EVENT_BEFORE:-}"
empty_tree_sha="0000000000000000000000000000000000000000"

if [ "${DEPLOY_ALL:-false}" = "true" ]; then
  echo "Deploying every service (deploy_all)."
  echo "base_sha=${empty_tree_sha}" >>"$output"
  exit 0
fi

last_success_sha="$(
  gh run list \
    --repo "$repository" \
    --workflow production-deploy.yml \
    --branch main \
    --status success \
    --limit 1 \
    --json headSha \
    --jq '.[0].headSha // empty'
)" || {
  echo "::warning::Could not look up the last successful deploy."
  last_success_sha=""
}

base_sha="$last_success_sha"
if [ -n "$base_sha" ] && ! git merge-base --is-ancestor "$base_sha" "$head_sha" 2>/dev/null; then
  echo "Last successful deploy ${base_sha} is not an ancestor of ${head_sha}; falling back."
  base_sha=""
fi

if [ -z "$base_sha" ]; then
  base_sha="${event_before:-$empty_tree_sha}"
  echo "No usable successful deploy; diffing against ${base_sha}."
else
  echo "Diffing against the last successful deploy ${base_sha}."
fi

echo "base_sha=${base_sha}" >>"$output"
