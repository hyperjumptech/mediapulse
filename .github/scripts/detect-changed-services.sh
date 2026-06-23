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

changed_files="$(git diff --name-only "$base_sha" "$head_sha")"

if [ -z "$changed_files" ]; then
  echo "any=false" >>"$GITHUB_OUTPUT"
  echo "matrix=[]" >>"$GITHUB_OUTPUT"
  exit 0
fi

shared_changed=false
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    packages/* | pnpm-lock.yaml | pnpm-workspace.yaml | turbo.json)
      shared_changed=true
      break
      ;;
  esac
done <<<"$changed_files"

services_list=""

append_service() {
  local name="$1"
  if ! grep -qx "$name" <<<"$services_list"; then
    services_list+="${name}"$'\n'
  fi
}

if [ "$shared_changed" = "true" ]; then
  case "$workflow" in
    app)
      services_list=$'agent-auth-api\nagent-data-api\ndomain-api\nagent-registry-api\nuser-registration\nhermes\nhermes-worker\n'
      ;;
    agent)
      services_list=$'data-collection\ncontent-generation\narticle-analysis\nquery-analysis\ndelivery\nticker-echo\nagent-user-registration\nagent-newsletter-feedback\npage-collection\n'
      ;;
  esac
else
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      apps/mediapulse/user-registration/*)
        [ "$workflow" = "app" ] && append_service "user-registration"
        ;;
      apps/mediapulse/domain-api/*)
        [ "$workflow" = "app" ] && append_service "domain-api"
        ;;
      apps/mediapulse/agent-data-api/*)
        [ "$workflow" = "app" ] && append_service "agent-data-api"
        ;;
      apps/hermes/agent-auth-api/*)
        [ "$workflow" = "app" ] && append_service "agent-auth-api"
        ;;
      apps/hermes/agent-registry-api/*)
        [ "$workflow" = "app" ] && append_service "agent-registry-api"
        ;;
      apps/hermes/dashboard/*)
        [ "$workflow" = "app" ] && append_service "hermes"
        ;;
      apps/hermes/worker/*)
        [ "$workflow" = "app" ] && append_service "hermes-worker"
        ;;
      apps/mediapulse/agents/data-collection/*)
        [ "$workflow" = "agent" ] && append_service "data-collection"
        ;;
      apps/mediapulse/agents/content-generation/*)
        [ "$workflow" = "agent" ] && append_service "content-generation"
        ;;
      apps/mediapulse/agents/delivery/*)
        [ "$workflow" = "agent" ] && append_service "delivery"
        ;;
      apps/mediapulse/agents/ticker-echo/*)
        [ "$workflow" = "agent" ] && append_service "ticker-echo"
        ;;
      apps/mediapulse/agents/article-analysis/*)
        [ "$workflow" = "agent" ] && append_service "article-analysis"
        ;;
      apps/mediapulse/agents/query-analysis/*)
        [ "$workflow" = "agent" ] && append_service "query-analysis"
        ;;
      apps/mediapulse/agents/user-registration/*)
        [ "$workflow" = "agent" ] && append_service "agent-user-registration"
        ;;
      apps/mediapulse/agents/newsletter-feedback/*)
        [ "$workflow" = "agent" ] && append_service "agent-newsletter-feedback"
        ;;
      apps/mediapulse/agents/page-collection/*)
        [ "$workflow" = "agent" ] && append_service "page-collection"
        ;;
    esac
  done <<<"$changed_files"
fi

services_list="$(echo "$services_list" | sort -u | grep -v '^$' || true)"

if [ -z "$services_list" ]; then
  echo "any=false" >>"$GITHUB_OUTPUT"
  echo "matrix=[]" >>"$GITHUB_OUTPUT"
  exit 0
fi

lookup_service_config() {
  local service="$1"
  case "$service" in
    agent-auth-api)
      echo '{"service":"agent-auth-api","dockerfile":"apps/hermes/agent-auth-api/Dockerfile","image":"app-agent-auth-api","webhook_secret":"COOLIFY_WEBHOOK_APP_AGENT_AUTH_API"}'
      ;;
    agent-data-api)
      echo '{"service":"agent-data-api","dockerfile":"apps/mediapulse/agent-data-api/Dockerfile","image":"app-agent-data-api","webhook_secret":"COOLIFY_WEBHOOK_APP_AGENT_DATA_API"}'
      ;;
    domain-api)
      echo '{"service":"domain-api","dockerfile":"apps/mediapulse/domain-api/Dockerfile","image":"app-domain-api","webhook_secret":"COOLIFY_WEBHOOK_APP_DOMAIN_API"}'
      ;;
    agent-registry-api)
      echo '{"service":"agent-registry-api","dockerfile":"apps/hermes/agent-registry-api/Dockerfile","image":"app-agent-registry-api","webhook_secret":"COOLIFY_WEBHOOK_APP_AGENT_REGISTRY_API"}'
      ;;
    user-registration)
      echo '{"service":"user-registration","dockerfile":"apps/mediapulse/user-registration/Dockerfile","image":"app-user-registration","webhook_secret":"COOLIFY_WEBHOOK_APP_USER_REGISTRATION"}'
      ;;
    hermes)
      echo '{"service":"hermes","dockerfile":"apps/hermes/dashboard/Dockerfile","image":"app-hermes","webhook_secret":"COOLIFY_WEBHOOK_APP_HERMES"}'
      ;;
    hermes-worker)
      echo '{"service":"hermes-worker","dockerfile":"apps/hermes/worker/Dockerfile","image":"app-hermes-worker","webhook_secret":"COOLIFY_WEBHOOK_APP_HERMES_WORKER"}'
      ;;
    data-collection)
      echo '{"service":"data-collection","dockerfile":"apps/mediapulse/agents/data-collection/Dockerfile","image":"agent-data-collection","webhook_secret":"COOLIFY_WEBHOOK_AGENT_DATA_COLLECTION"}'
      ;;
    content-generation)
      echo '{"service":"content-generation","dockerfile":"apps/mediapulse/agents/content-generation/Dockerfile","image":"agent-content-generation","webhook_secret":"COOLIFY_WEBHOOK_AGENT_CONTENT_GENERATION"}'
      ;;
    article-analysis)
      echo '{"service":"article-analysis","dockerfile":"apps/mediapulse/agents/article-analysis/Dockerfile","image":"agent-article-analysis","webhook_secret":"COOLIFY_WEBHOOK_AGENT_ARTICLE_ANALYSIS"}'
      ;;
    query-analysis)
      echo '{"service":"query-analysis","dockerfile":"apps/mediapulse/agents/query-analysis/Dockerfile","image":"agent-query-analysis","webhook_secret":"COOLIFY_WEBHOOK_AGENT_QUERY_ANALYSIS"}'
      ;;
    delivery)
      echo '{"service":"delivery","dockerfile":"apps/mediapulse/agents/delivery/Dockerfile","image":"agent-delivery","webhook_secret":"COOLIFY_WEBHOOK_AGENT_DELIVERY"}'
      ;;
    ticker-echo)
      echo '{"service":"ticker-echo","dockerfile":"apps/mediapulse/agents/ticker-echo/Dockerfile","image":"agent-ticker-echo","webhook_secret":"COOLIFY_WEBHOOK_AGENT_TICKER_ECHO"}'
      ;;
    agent-user-registration)
      echo '{"service":"agent-user-registration","dockerfile":"apps/mediapulse/agents/user-registration/Dockerfile","image":"agent-user-registration","webhook_secret":"COOLIFY_WEBHOOK_AGENT_USER_REGISTRATION"}'
      ;;
    agent-newsletter-feedback)
      echo '{"service":"agent-newsletter-feedback","dockerfile":"apps/mediapulse/agents/newsletter-feedback/Dockerfile","image":"agent-newsletter-feedback","webhook_secret":"COOLIFY_WEBHOOK_AGENT_NEWSLETTER_FEEDBACK"}'
      ;;
    page-collection)
      echo '{"service":"page-collection","dockerfile":"apps/mediapulse/agents/page-collection/Dockerfile","image":"agent-page-collection","webhook_secret":"COOLIFY_WEBHOOK_AGENT_PAGE_COLLECTION"}'
      ;;
    *)
      return 1
      ;;
  esac
}

matrix_items=""
while IFS= read -r service; do
  [ -z "$service" ] && continue
  item="$(lookup_service_config "$service")"
  if [ -n "$matrix_items" ]; then
    matrix_items+=","
  fi
  matrix_items+="$item"
done <<<"$services_list"

echo "any=true" >>"$GITHUB_OUTPUT"
printf 'matrix=[%s]\n' "$matrix_items" >>"$GITHUB_OUTPUT"
