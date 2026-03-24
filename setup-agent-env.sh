#!/usr/bin/env bash
# Sets up .env and .env.local for a new agent: runs dev-bootstrap (so the agent
# gets .env and .env.local from its env.agents.<name>.example), then copies
# DOMAIN_INTEGRATION_API_KEY from another agent or packages/mediapulse/env/.env
# into this agent's .env.local.
#
# Usage: ./setup-agent-env.sh <agent-name> [options]
# Options:
#   --no-bootstrap     Skip running dev-bootstrap.sh (use if .env/.env.local already exist).
#
# If no DOMAIN_INTEGRATION_API_KEY is found, run ./dev-setup-local.sh or from
# apps/hermes/dashboard: pnpm seed-local-domain-integration <admin-email>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_NAME=""
NO_BOOTSTRAP="false"

usage() {
  cat <<'EOF'
Usage: ./setup-agent-env.sh <agent-name> [options]

Options:
  --no-bootstrap       Skip dev-bootstrap (use if .env and .env.local already exist).

Examples:
  ./setup-agent-env.sh user-registration
  ./setup-agent-env.sh my-agent --no-bootstrap

If DOMAIN_INTEGRATION_API_KEY is missing, run ./dev-setup-local.sh first, or:
  cd apps/hermes/dashboard && pnpm seed-local-domain-integration <admin-email>
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-bootstrap)
      NO_BOOTSTRAP="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -z "$AGENT_NAME" ]]; then
        AGENT_NAME="$1"
      else
        echo "Unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$AGENT_NAME" ]]; then
  echo "Error: agent name is required." >&2
  usage >&2
  exit 1
fi

AGENT_DIR="$SCRIPT_DIR/apps/mediapulse/agents/$AGENT_NAME"
ENV_PKG="$SCRIPT_DIR/packages/mediapulse/env"
EXAMPLE_FILE="$ENV_PKG/env.agents.${AGENT_NAME}.example"

if [[ ! -d "$AGENT_DIR" ]]; then
  echo "Error: agent directory not found: $AGENT_DIR" >&2
  exit 1
fi

if [[ ! -f "$EXAMPLE_FILE" ]]; then
  echo "Error: env example not found: $EXAMPLE_FILE" >&2
  exit 1
fi

section() { echo ""; echo "▸ $1"; echo ""; }

# Upsert a key=value line in a file (create file if missing).
upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp_file
  tmp_file="$(mktemp)"
  if [[ ! -f "$file" ]]; then
    printf '%s=%s\n' "$key" "$value" > "$file"
    return
  fi
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

# Get value of KEY from a .env-style file; output to stdout, empty if not set or file missing.
get_env_value() {
  local file="$1"
  local key="$2"
  if [[ ! -f "$file" ]]; then
    return
  fi
  awk -v key="$key" -F= '
    $1 == key && NF >= 2 {
      sub(/^[^=]*=/, ""); gsub(/^[" ]+|[" ]+$/, ""); print; exit
    }
  ' "$file"
}

section "Bootstrap env for agent: $AGENT_NAME"
if [[ "$NO_BOOTSTRAP" != "true" ]]; then
  "$SCRIPT_DIR/dev-bootstrap.sh"
else
  echo "Skipping bootstrap (--no-bootstrap)."
  # Ensure .env and .env.local exist for this agent
  cd "$AGENT_DIR"
  ln -sf "$ENV_PKG/.env" ".env"
  [[ -L ".env.local" ]] && rm -f ".env.local"
  "$ENV_PKG/merge-agent-env.sh" "$EXAMPLE_FILE" ".env.local" 2>/dev/null || true
  cd - >/dev/null
  echo "  ✓ Merged $EXAMPLE_FILE into $AGENT_DIR/.env.local"
fi

section "Get DOMAIN_INTEGRATION_API_KEY (domain integration)"
RAW_KEY=""

# 1. From any existing agent .env.local
for f in "$SCRIPT_DIR/apps/mediapulse/agents"/*/.env.local; do
  if [[ -f "$f" ]]; then
    RAW_KEY="$(get_env_value "$f" "DOMAIN_INTEGRATION_API_KEY")"
    if [[ -n "$RAW_KEY" ]]; then
      echo "  Using existing DOMAIN_INTEGRATION_API_KEY from $(dirname "$f")/.env.local"
      break
    fi
  fi
done

# 2. From packages/mediapulse/env/.env
if [[ -z "$RAW_KEY" && -f "$SCRIPT_DIR/packages/mediapulse/env/.env" ]]; then
  RAW_KEY="$(get_env_value "$SCRIPT_DIR/packages/mediapulse/env/.env" "DOMAIN_INTEGRATION_API_KEY")"
  if [[ -n "$RAW_KEY" ]]; then
    echo "  Using DOMAIN_INTEGRATION_API_KEY from packages/mediapulse/env/.env"
  fi
fi

if [[ -z "$RAW_KEY" ]]; then
  echo "  No DOMAIN_INTEGRATION_API_KEY found."
  echo "  Run ./dev-setup-local.sh to create an admin and domain integration, or:"
  echo "    cd apps/hermes/dashboard && pnpm seed-local-domain-integration <admin-email>"
  exit 1
fi

ENV_LOCAL="$AGENT_DIR/.env.local"
if [[ ! -f "$ENV_LOCAL" ]]; then
  touch "$ENV_LOCAL"
fi
upsert_env_var "$ENV_LOCAL" "DOMAIN_INTEGRATION_API_KEY" "$RAW_KEY"
echo "  ✓ Set DOMAIN_INTEGRATION_API_KEY in $AGENT_DIR/.env.local"

section "Done"
echo "Agent $AGENT_NAME has .env and .env.local with correct values (PORT from example, DOMAIN_INTEGRATION_API_KEY set)."
echo "Run: pnpm dev:agent-$AGENT_NAME"
