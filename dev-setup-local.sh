#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERMES_ENV_FILE="$SCRIPT_DIR/packages/hermes/env/.env"
MEDIAPULSE_ENV_FILE="$SCRIPT_DIR/packages/mediapulse/env/.env"
NON_INTERACTIVE="false"
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
AGENT_AUTH_API_URL="http://localhost:8080"
# Default domain integration (same as dashboard wizard): integration key + display name; API key is generated and stored encrypted in orchestration DB.
DOMAIN_INTEGRATION_KEY="${DOMAIN_INTEGRATION_KEY:-mediapulse}"
DOMAIN_INTEGRATION_DISPLAY_NAME="${DOMAIN_INTEGRATION_DISPLAY_NAME:-Local dev Mediapulse}"
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

# Prints the value for KEY from the first matching line in a dotenv file. Strips a trailing
# inline comment (# …) and leading/trailing whitespace, and optional matching double quotes.
# Use this instead of raw line length: lines like KEY= #required are long but have an empty value.
read_dotenv_value() {
  local file="$1"
  local key="$2"
  awk -v key="$key" '
    $0 ~ "^" key "=" {
      v = substr($0, length(key) + 2)
      sub(/#.*/, "", v)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", v)
      if (v ~ /^".*"$/) {
        gsub(/^"|"$/, "", v)
      }
      print v
      exit
    }
  ' "$file" 2>/dev/null
}

# Parses PLAIN_API_KEY= and INTEGRATION_KEY= lines from seed-local-domain-integration output.
read_plain_api_key_from_seed_output() {
  local output="$1"
  local line
  line="$(printf "%s\n" "$output" | grep '^PLAIN_API_KEY=' | head -n 1)"
  printf "%s" "${line#PLAIN_API_KEY=}"
}

read_integration_key_from_seed_output() {
  local output="$1"
  local line
  line="$(printf "%s\n" "$output" | grep '^INTEGRATION_KEY=' | head -n 1)"
  printf "%s" "${line#INTEGRATION_KEY=}"
}

seed_output_has_skip_plaintext() {
  local output="$1"
  printf "%s\n" "$output" | grep -q '^SKIP_PLAINTEXT=1$'
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
  --domain-integration-key <key>    Integration key stored in Hermes (default: mediapulse).
  --domain-integration-name <name>  Display name for the domain integration row (default: Local dev Mediapulse).
  --local-dev-api-key-name <name>     Deprecated alias for --domain-integration-name.
  --jwt-secret <secret>             AGENT_AUTH_JWT_SECRET value (default: generated with openssl).
  --skip-install                    Skip pnpm install.
  --skip-migrations                 Skip Prisma and DataQueue migrations.
  --skip-admin                      Skip admin creation and domain integration seed (no DB row / env API key).
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
      --domain-integration-key)
        DOMAIN_INTEGRATION_KEY="${2:-}"
        shift 2
        ;;
      --domain-integration-name)
        DOMAIN_INTEGRATION_DISPLAY_NAME="${2:-}"
        shift 2
        ;;
      --local-dev-api-key-name)
        DOMAIN_INTEGRATION_DISPLAY_NAME="${2:-}"
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
    DOMAIN_INTEGRATION_KEY="$(prompt_with_default "Domain integration key (e.g. mediapulse)" "$DOMAIN_INTEGRATION_KEY")"
    DOMAIN_INTEGRATION_DISPLAY_NAME="$(prompt_with_default "Domain integration display name" "$DOMAIN_INTEGRATION_DISPLAY_NAME")"
  fi
}

set_domain_integration_env_for_all_agents() {
  local api_key="$1"
  local integration_key="$2"
  local agent_dir
  local env_local_file

  for agent_dir in "$SCRIPT_DIR/apps/mediapulse/agents"/*; do
    if [[ -d "$agent_dir" ]]; then
      env_local_file="$agent_dir/.env.local"
      if [[ ! -f "$env_local_file" ]]; then
        touch "$env_local_file"
      fi
      upsert_env_var "$env_local_file" "DOMAIN_INTEGRATION_API_KEY" "$api_key"
      upsert_env_var "$env_local_file" "DOMAIN_INTEGRATION_KEY" "$integration_key"
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
  if [[ -z "$(read_dotenv_value "$HERMES_ENV_FILE" "HERMES_INTERNAL_API_KEY")" ]]; then
    upsert_env_var "$HERMES_ENV_FILE" "HERMES_INTERNAL_API_KEY" "$(openssl rand -base64 32)"
  fi
  upsert_env_var "$MEDIAPULSE_ENV_FILE" "AGENT_AUTH_JWT_SECRET" "$JWT_SECRET"
  upsert_env_var "$MEDIAPULSE_ENV_FILE" "AGENT_AUTH_API_URL" "$AGENT_AUTH_API_URL"
  pnpm --filter @hermes/env build && pnpm --filter @mediapulse/env build

  if [[ "$SKIP_MIGRATIONS" == "true" ]]; then
    section "Database migrations"
    echo "Skipping migrations (--skip-migrations)."
  else
    section "Database migrations"
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
    pnpm --filter @hermes/worker run migrate-dataqueue:dev
  fi

  if [[ "$SKIP_ADMIN" == "true" ]]; then
    section "Admin and domain integration seed"
    echo "Skipping admin and domain integration seed (--skip-admin)."
    if [[ -z "$(read_dotenv_value "$HERMES_ENV_FILE" "HERMES_INTERNAL_API_KEY")" ]]; then
      echo "Warning: HERMES_INTERNAL_API_KEY is empty in $HERMES_ENV_FILE."
      echo "Hermes worker and dashboard need it to mint JWTs (run dev-setup without --skip-admin or set it manually)."
    fi
    if [[ -z "$(read_dotenv_value "$MEDIAPULSE_ENV_FILE" "DOMAIN_INTEGRATION_API_KEY")" ]]; then
      echo "Warning: DOMAIN_INTEGRATION_API_KEY is empty in $MEDIAPULSE_ENV_FILE."
      echo "Mediapulse domain-api and agents need it (Hermes domain_integration key)."
    fi
  else
    section "Create admin and domain integration (encrypted API key in DB)"
    (
      cd apps/hermes/dashboard
      pnpm create:admin "$ADMIN_EMAIL" "$ADMIN_PASSWORD" >/dev/null
    )

    SEED_OUTPUT="$(
      cd apps/hermes/dashboard
      pnpm seed-local-domain-integration "$ADMIN_EMAIL" "$DOMAIN_INTEGRATION_KEY" "$DOMAIN_INTEGRATION_DISPLAY_NAME"
    )"
    RESOLVED_INTEGRATION_KEY="$(read_integration_key_from_seed_output "$SEED_OUTPUT")"
    if [[ -z "$RESOLVED_INTEGRATION_KEY" ]]; then
      echo "Could not parse INTEGRATION_KEY from seed-local-domain-integration output."
      exit 1
    fi

    upsert_env_var "$MEDIAPULSE_ENV_FILE" "DOMAIN_INTEGRATION_KEY" "$RESOLVED_INTEGRATION_KEY"

    if seed_output_has_skip_plaintext "$SEED_OUTPUT"; then
      echo "Domain integration already existed; left DOMAIN_INTEGRATION_API_KEY unchanged (set manually if missing)."
      for agent_dir in "$SCRIPT_DIR/apps/mediapulse/agents"/*; do
        if [[ -d "$agent_dir" ]]; then
          env_local_file="$agent_dir/.env.local"
          [[ -f "$env_local_file" ]] || touch "$env_local_file"
          upsert_env_var "$env_local_file" "DOMAIN_INTEGRATION_KEY" "$RESOLVED_INTEGRATION_KEY"
        fi
      done
    else
      LOCAL_DEV_API_KEY="$(read_plain_api_key_from_seed_output "$SEED_OUTPUT")"
      if [[ -z "$LOCAL_DEV_API_KEY" ]]; then
        echo "Could not parse PLAIN_API_KEY from seed-local-domain-integration output."
        exit 1
      fi
      upsert_env_var "$MEDIAPULSE_ENV_FILE" "DOMAIN_INTEGRATION_API_KEY" "$LOCAL_DEV_API_KEY"
      set_domain_integration_env_for_all_agents "$LOCAL_DEV_API_KEY" "$RESOLVED_INTEGRATION_KEY"
    fi
    pnpm --filter @mediapulse/env build
  fi

  section "Done"
  echo "Updated $HERMES_ENV_FILE and $MEDIAPULSE_ENV_FILE with:"
  echo "  - AGENT_AUTH_JWT_SECRET"
  echo "  - AGENT_AUTH_API_URL=$AGENT_AUTH_API_URL"
  echo "  - HERMES_INTERNAL_API_KEY (Hermes worker, dashboard, agent-auth; preset secret)"
  echo "  - DOMAIN_INTEGRATION_KEY"
  echo "  - DOMAIN_INTEGRATION_API_KEY (generated once; stored encrypted in orchestration DB)"
  echo "Updated apps/mediapulse/agents/*/.env.local with:"
  echo "  - DOMAIN_INTEGRATION_API_KEY"
  echo "  - DOMAIN_INTEGRATION_KEY"
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
