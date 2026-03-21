#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERMES_ENV_FILE="$SCRIPT_DIR/packages/hermes/env/.env"
MEDIAPULSE_ENV_FILE="$SCRIPT_DIR/packages/mediapulse/env/.env"
NON_INTERACTIVE="false"
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
AGENT_AUTH_API_URL="http://localhost:8080"
SCHEDULER_KEY_NAME="Local dev scheduler"
REGISTRY_KEY_NAME="Local dev registry"
JWT_SECRET=""
SKIP_INSTALL="false"
SKIP_MIGRATIONS="false"
SKIP_ADMIN="false"

section() {
  echo ""
  echo "▸ $1"
  echo ""
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

prompt_non_empty() {
  local prompt="$1"
  local value=""
  while [[ -z "$value" ]]; do
    read -r -p "$prompt" value
  done
  printf "%s" "$value"
}

prompt_non_empty_secret() {
  local prompt="$1"
  local value=""
  while [[ -z "$value" ]]; do
    read -r -s -p "$prompt" value
    echo "" >&2
  done
  printf "%s" "$value"
}

prompt_with_default() {
  local prompt="$1"
  local default_value="$2"
  local value=""
  read -r -p "$prompt [$default_value]: " value
  if [[ -z "$value" ]]; then
    value="$default_value"
  fi
  printf "%s" "$value"
}

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp_file
  tmp_file="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^" key "=" {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (updated == 0) {
        print key "=" value
      }
    }
  ' "$file" > "$tmp_file"

  mv "$tmp_file" "$file"
}

extract_generated_api_key() {
  local output="$1"
  printf "%s\n" "$output" | awk '
    /Raw key \(store securely, shown once\):/ {
      getline
      print
      exit
    }
  '
}

usage() {
  cat <<'EOF'
Usage:
  ./dev-setup-local.sh
  ./dev-setup-local.sh --non-interactive --admin-email <email> --admin-password <password> [options]

Options:
  --non-interactive                 Run without prompts.
  --admin-email <email>             Admin email (required in non-interactive mode).
  --admin-password <password>       Admin password (required in non-interactive mode).
  --agent-auth-api-url <url>        AGENT_AUTH_API_URL value (default: http://localhost:8080).
  --scheduler-key-name <name>       Scheduler API key name (default: Local dev scheduler).
  --registry-key-name <name>        Registry API key name (default: Local dev registry).
  --jwt-secret <secret>             AGENT_AUTH_JWT_SECRET value (default: generated with openssl).
  --skip-install                    Skip pnpm install.
  --skip-migrations                 Skip Prisma and DataQueue migrations.
  --skip-admin                      Skip admin creation and scheduler API key generation.
  -h, --help                        Show this help text.

Examples:
  ./dev-setup-local.sh
  ./dev-setup-local.sh --non-interactive --admin-email dev@example.com --admin-password "ChangeMe123!"
  ./dev-setup-local.sh --skip-install --skip-migrations --skip-admin
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --non-interactive)
        NON_INTERACTIVE="true"
        shift
        ;;
      --admin-email)
        ADMIN_EMAIL="${2:-}"
        shift 2
        ;;
      --admin-password)
        ADMIN_PASSWORD="${2:-}"
        shift 2
        ;;
      --agent-auth-api-url)
        AGENT_AUTH_API_URL="${2:-}"
        shift 2
        ;;
      --scheduler-key-name)
        SCHEDULER_KEY_NAME="${2:-}"
        shift 2
        ;;
      --registry-key-name)
        REGISTRY_KEY_NAME="${2:-}"
        shift 2
        ;;
      --jwt-secret)
        JWT_SECRET="${2:-}"
        shift 2
        ;;
      --skip-install)
        SKIP_INSTALL="true"
        shift
        ;;
      --skip-migrations)
        SKIP_MIGRATIONS="true"
        shift
        ;;
      --skip-admin)
        SKIP_ADMIN="true"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1"
        echo ""
        usage
        exit 1
        ;;
    esac
  done
}

validate_non_interactive_inputs() {
  if [[ "$SKIP_ADMIN" == "true" ]]; then
    return
  fi

  if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
    echo "In non-interactive mode, --admin-email and --admin-password are required."
    echo ""
    usage
    exit 1
  fi
}

collect_interactive_inputs() {
  section "Local setup inputs"
  AGENT_AUTH_API_URL="$(prompt_with_default "Agent auth API URL" "$AGENT_AUTH_API_URL")"
  if [[ "$SKIP_ADMIN" == "false" ]]; then
    ADMIN_EMAIL="$(prompt_non_empty "Admin email: ")"
    ADMIN_PASSWORD="$(prompt_non_empty_secret "Admin password: ")"
    SCHEDULER_KEY_NAME="$(prompt_with_default "Scheduler key name" "$SCHEDULER_KEY_NAME")"
    REGISTRY_KEY_NAME="$(prompt_with_default "Registry key name" "$REGISTRY_KEY_NAME")"
  fi
}

set_agent_registry_api_key_for_all_agents() {
  local api_key="$1"
  local agent_dir
  local env_local_file

  for agent_dir in "$SCRIPT_DIR/apps/mediapulse/agents"/*; do
    if [[ -d "$agent_dir" ]]; then
      env_local_file="$agent_dir/.env.local"
      if [[ ! -f "$env_local_file" ]]; then
        touch "$env_local_file"
      fi
      upsert_env_var "$env_local_file" "AGENT_REGISTRY_API_KEY" "$api_key"
    fi
  done
}

main() {
  parse_args "$@"
  require_command "pnpm"
  require_command "openssl"

  cd "$SCRIPT_DIR"

  if [[ "$NON_INTERACTIVE" == "true" ]]; then
    validate_non_interactive_inputs
  else
    collect_interactive_inputs
  fi

  section "Install dependencies"
  if [[ "$SKIP_INSTALL" == "true" ]]; then
    echo "Skipping pnpm install (--skip-install)."
  else
    pnpm install
  fi

  section "Bootstrap and build env"
  ./dev-bootstrap.sh
  if [[ ! -f "$HERMES_ENV_FILE" || ! -f "$MEDIAPULSE_ENV_FILE" ]]; then
    echo "Expected env files after bootstrap:"
    echo "  $HERMES_ENV_FILE"
    echo "  $MEDIAPULSE_ENV_FILE"
    exit 1
  fi
  if [[ -z "$JWT_SECRET" ]]; then
    JWT_SECRET="$(openssl rand -base64 32)"
  fi
  upsert_env_var "$HERMES_ENV_FILE" "AGENT_AUTH_JWT_SECRET" "$JWT_SECRET"
  upsert_env_var "$HERMES_ENV_FILE" "AGENT_AUTH_API_URL" "$AGENT_AUTH_API_URL"
  upsert_env_var "$MEDIAPULSE_ENV_FILE" "AGENT_AUTH_JWT_SECRET" "$JWT_SECRET"
  upsert_env_var "$MEDIAPULSE_ENV_FILE" "AGENT_AUTH_API_URL" "$AGENT_AUTH_API_URL"
  pnpm --filter @hermes/env build && pnpm --filter @mediapulse/env build

  if [[ "$SKIP_MIGRATIONS" == "true" ]]; then
    section "Database migrations"
    echo "Skipping migrations (--skip-migrations)."
  else
    section "Database migrations"
    # node "$SCRIPT_DIR/scripts/ensure-prisma-shadow-databases.mjs"
    (
      cd packages/hermes/orchestration-database
      pnpm db:migrate:dev
      pnpm db:generate
    )
    (
      cd packages/mediapulse/database
      pnpm db:migrate:dev
      pnpm db:generate
    )
    pnpm --filter hermes-worker run migrate-dataqueue:dev
  fi

  if [[ "$SKIP_ADMIN" == "true" ]]; then
    section "Admin and scheduler API key"
    echo "Skipping admin and API key generation (--skip-admin)."
    if ! awk '/^AGENT_API_KEY=/{ if (length($0) > 14) found=1 } END { exit(found ? 0 : 1) }' "$HERMES_ENV_FILE"; then
      echo "Warning: AGENT_API_KEY is empty in $HERMES_ENV_FILE."
      echo "Hermes worker may fail until AGENT_API_KEY is set."
    fi
  else
    section "Create admin and API keys"
    (
      cd apps/hermes/dashboard
      pnpm create:admin "$ADMIN_EMAIL" "$ADMIN_PASSWORD" >/dev/null
    )

    SCHEDULER_OUTPUT="$(
      cd apps/hermes/dashboard
      pnpm generate-api-key "$ADMIN_EMAIL" "$SCHEDULER_KEY_NAME" --purpose scheduler
    )"
    SCHEDULER_API_KEY="$(extract_generated_api_key "$SCHEDULER_OUTPUT")"
    if [[ -z "$SCHEDULER_API_KEY" ]]; then
      echo "Could not parse generated API key from output."
      echo "Please run apps/hermes/scripts/generate-api-key.ts manually."
      exit 1
    fi

    REGISTRY_OUTPUT="$(
      cd apps/hermes/dashboard
      pnpm generate-api-key "$ADMIN_EMAIL" "$REGISTRY_KEY_NAME" --purpose general
    )"
    REGISTRY_API_KEY="$(extract_generated_api_key "$REGISTRY_OUTPUT")"
    if [[ -z "$REGISTRY_API_KEY" ]]; then
      echo "Could not parse generated registry API key from output."
      echo "Please run apps/hermes/scripts/generate-api-key.ts manually."
      exit 1
    fi

    upsert_env_var "$HERMES_ENV_FILE" "AGENT_API_KEY" "$SCHEDULER_API_KEY"
    upsert_env_var "$HERMES_ENV_FILE" "AGENT_REGISTRY_API_KEY" "$REGISTRY_API_KEY"
    upsert_env_var "$MEDIAPULSE_ENV_FILE" "AGENT_API_KEY" "$SCHEDULER_API_KEY"
    upsert_env_var "$MEDIAPULSE_ENV_FILE" "AGENT_REGISTRY_API_KEY" "$REGISTRY_API_KEY"
    set_agent_registry_api_key_for_all_agents "$REGISTRY_API_KEY"
  fi

  section "Done"
  echo "Updated $HERMES_ENV_FILE and $MEDIAPULSE_ENV_FILE with:"
  echo "  - AGENT_AUTH_JWT_SECRET"
  echo "  - AGENT_AUTH_API_URL=$AGENT_AUTH_API_URL"
  echo "  - AGENT_API_KEY"
  echo "  - AGENT_REGISTRY_API_KEY"
  echo "Updated apps/mediapulse/agents/*/.env.local with:"
  echo "  - AGENT_REGISTRY_API_KEY"
  if [[ "$SKIP_ADMIN" == "false" ]]; then
    echo ""
    echo "Admin credentials:"
    echo "  - Email: $ADMIN_EMAIL"
    echo "  - Password: $ADMIN_PASSWORD"
  fi
  echo ""
  echo "Next step: pnpm dev"
}

main "$@"
