#!/usr/bin/env bash
# Detect which deployable services changed between two commits and emit a GitHub Actions matrix.
#
# Usage:
#   WORKFLOW=app BASE_SHA=<sha> HEAD_SHA=<sha> ./detect-changed-services.sh
#   WORKFLOW=agent BASE_SHA=<sha> HEAD_SHA=<sha> ./detect-changed-services.sh
#
# Outputs (GITHUB_OUTPUT):
#   any=true|false
#   matrix=[{service,dockerfile,image,webhook_secret}, ...]

set -euo pipefail

workflow="${WORKFLOW:?WORKFLOW must be app or agent}"
base_sha="${BASE_SHA:?BASE_SHA is required}"
head_sha="${HEAD_SHA:?HEAD_SHA is required}"

if [ "$base_sha" = "0000000000000000000000000000000000000000" ]; then
  echo "any=true" >>"${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
  case "$workflow" in
    app)
      echo 'matrix=[{"service":"agent-auth-api","dockerfile":"apps/hermes/agent-auth-api/Dockerfile","image":"app-agent-auth-api","webhook_secret":"COOLIFY_WEBHOOK_APP_AGENT_AUTH_API"},{"service":"agent-data-api","dockerfile":"apps/mediapulse/agent-data-api/Dockerfile","image":"app-agent-data-api","webhook_secret":"COOLIFY_WEBHOOK_APP_AGENT_DATA_API"},{"service":"domain-api","dockerfile":"apps/mediapulse/domain-api/Dockerfile","image":"app-domain-api","webhook_secret":"COOLIFY_WEBHOOK_APP_DOMAIN_API"},{"service":"agent-registry-api","dockerfile":"apps/hermes/agent-registry-api/Dockerfile","image":"app-agent-registry-api","webhook_secret":"COOLIFY_WEBHOOK_APP_AGENT_REGISTRY_API"},{"service":"user-registration","dockerfile":"apps/mediapulse/user-registration/Dockerfile","image":"app-user-registration","webhook_secret":"COOLIFY_WEBHOOK_APP_USER_REGISTRATION"},{"service":"hermes","dockerfile":"apps/hermes/dashboard/Dockerfile","image":"app-hermes","webhook_secret":"COOLIFY_WEBHOOK_APP_HERMES"},{"service":"hermes-worker","dockerfile":"apps/hermes/worker/Dockerfile","image":"app-hermes-worker","webhook_secret":"COOLIFY_WEBHOOK_APP_HERMES_WORKER"}]' >>"$GITHUB_OUTPUT"
      ;;
    agent)
      echo 'matrix=[{"service":"data-collection","dockerfile":"apps/mediapulse/agents/data-collection/Dockerfile","image":"agent-data-collection","webhook_secret":"COOLIFY_WEBHOOK_AGENT_DATA_COLLECTION"},{"service":"content-generation","dockerfile":"apps/mediapulse/agents/content-generation/Dockerfile","image":"agent-content-generation","webhook_secret":"COOLIFY_WEBHOOK_AGENT_CONTENT_GENERATION"},{"service":"article-analysis","dockerfile":"apps/mediapulse/agents/article-analysis/Dockerfile","image":"agent-article-analysis","webhook_secret":"COOLIFY_WEBHOOK_AGENT_ARTICLE_ANALYSIS"},{"service":"query-analysis","dockerfile":"apps/mediapulse/agents/query-analysis/Dockerfile","image":"agent-query-analysis","webhook_secret":"COOLIFY_WEBHOOK_AGENT_QUERY_ANALYSIS"},{"service":"delivery","dockerfile":"apps/mediapulse/agents/delivery/Dockerfile","image":"agent-delivery","webhook_secret":"COOLIFY_WEBHOOK_AGENT_DELIVERY"},{"service":"ticker-echo","dockerfile":"apps/mediapulse/agents/ticker-echo/Dockerfile","image":"agent-ticker-echo","webhook_secret":"COOLIFY_WEBHOOK_AGENT_TICKER_ECHO"},{"service":"agent-user-registration","dockerfile":"apps/mediapulse/agents/user-registration/Dockerfile","image":"agent-user-registration","webhook_secret":"COOLIFY_WEBHOOK_AGENT_USER_REGISTRATION"},{"service":"agent-newsletter-feedback","dockerfile":"apps/mediapulse/agents/newsletter-feedback/Dockerfile","image":"agent-newsletter-feedback","webhook_secret":"COOLIFY_WEBHOOK_AGENT_NEWSLETTER_FEEDBACK"},{"service":"page-collection","dockerfile":"apps/mediapulse/agents/page-collection/Dockerfile","image":"agent-page-collection","webhook_secret":"COOLIFY_WEBHOOK_AGENT_PAGE_COLLECTION"}]' >>"$GITHUB_OUTPUT"
      ;;
    *)
      echo "Unsupported WORKFLOW: $workflow" >&2
      exit 1
      ;;
  esac
  exit 0
fi

node scripts/detect-pr-changes.mjs \
  --base "$base_sha" \
  --head "$head_sha" \
  --workflow "$workflow" \
  --format gha-deploy
