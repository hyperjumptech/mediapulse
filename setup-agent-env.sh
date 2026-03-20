#!/usr/bin/env bash
# Sets up .env and .env.local for a new agent: runs dev-bootstrap (so the agent
# gets .env and .env.local from its env.agents.<name>.example), then gets or
# creates AGENT_REGISTRY_API_KEY and sets it in the agent's .env.local.
#
# Usage: ./setup-agent-env.sh <agent-name> [options]
# Options:
#   --no-bootstrap     Skip running dev-bootstrap.sh (use if .env/.env.local already exist).
#   --admin-email EMAIL Use this email when creating a new registry API key (required for create).
#   --key-name NAME    Name for the new API key (default: "Agent registry (<agent-name>)").
#
# Get or create: reads AGENT_REGISTRY_API_KEY from any existing apps/agents/*/.env.local
# or packages/env/.env; if missing, creates one via Hermes generate-api-key (requires
# --admin-email and Hermes .env.local with DB).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_NAME=""
NO_BOOTSTRAP="false"
ADMIN_EMAIL=""
KEY_NAME=""

usage() {
  cat <<'EOF'
Usage: ./setup-agent-env.sh <agent-name> [options]

Options:
  --no-bootstrap       Skip dev-bootstrap (use if .env and .env.local already exist).
  --admin-email EMAIL  Admin email for creating a new registry API key (required to create).
  --key-name NAME      Name for the new API key (default: "Agent registry (<agent-name>)").

Examples:
  ./setup-agent-env.sh user-registration
  ./setup-agent-env.sh user-registration --admin-email dev@example.com
  ./setup-agent-env.sh my-agent --no-bootstrap
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-bootstrap)
      NO_BOOTSTRAP="true"
      shift
      ;;
    --admin-email)
      ADMIN_EMAIL="${2:-}"
      shift 2
      ;;
    --key-name)
      KEY_NAME="${2:-}"
      shift 2
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

AGENT_DIR="$SCRIPT_DIR/apps/agents/$AGENT_NAME"
ENV_PKG="$SCRIPT_DIR/packages/env"
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

# Extract the raw API key from generate-api-key.ts output.
extract_generated_api_key() {
  awk '
    /Raw key \(store securely, shown once\):/ {
      getline; print; exit
    }
  '
}

section "Bootstrap env for agent: $AGENT_NAME"
if [[ "$NO_BOOTSTRAP" != "true" ]]; then
  "$SCRIPT_DIR/dev-bootstrap.sh"
else
  echo "Skipping bootstrap (--no-bootstrap)."
  # Ensure .env and .env.local exist for this agent
  cd "$AGENT_DIR"
  ln -sf "../../../packages/env/.env" ".env"
  [[ -L ".env.local" ]] && rm -f ".env.local"
  "$ENV_PKG/merge-agent-env.sh" "$EXAMPLE_FILE" ".env.local" 2>/dev/null || true
  cd - >/dev/null
  echo "  ✓ Merged $EXAMPLE_FILE into $AGENT_DIR/.env.local"
fi

section "Get or create AGENT_REGISTRY_API_KEY"
REGISTRY_KEY=""

# 1. From any existing agent .env.local
for f in "$SCRIPT_DIR/apps/agents"/*/.env.local; do
  if [[ -f "$f" ]]; then
    REGISTRY_KEY="$(get_env_value "$f" "AGENT_REGISTRY_API_KEY")"
    if [[ -n "$REGISTRY_KEY" ]]; then
      echo "  Using existing key from $(dirname "$f")/.env.local"
      break
    fi
  fi
done

# 2. From packages/env/.env
if [[ -z "$REGISTRY_KEY" && -f "$SCRIPT_DIR/packages/env/.env" ]]; then
  REGISTRY_KEY="$(get_env_value "$SCRIPT_DIR/packages/env/.env" "AGENT_REGISTRY_API_KEY")"
  if [[ -n "$REGISTRY_KEY" ]]; then
    echo "  Using key from packages/env/.env"
  fi
fi

# 3. Create via Hermes generate-api-key
if [[ -z "$REGISTRY_KEY" ]]; then
  if [[ -z "$ADMIN_EMAIL" ]]; then
    # Try env
    ADMIN_EMAIL="${ADMIN_EMAIL:-}"
    if [[ -f "$SCRIPT_DIR/packages/env/.env" ]]; then
      ADMIN_EMAIL="$(get_env_value "$SCRIPT_DIR/packages/env/.env" "ADMIN_EMAIL")"
    fi
  fi
  if [[ -z "$ADMIN_EMAIL" ]]; then
    echo "  No existing AGENT_REGISTRY_API_KEY found."
    echo "  To create one, run: ./setup-agent-env.sh $AGENT_NAME --admin-email <your-admin-email>"
    echo "  Or run ./dev-setup-local.sh first to create admin and a registry key for all agents."
    exit 1
  fi
  KEY_NAME="${KEY_NAME:-Agent registry ($AGENT_NAME)}"
  echo "  Creating new API key via Hermes generate-api-key..."
  HERMES_OUTPUT="$(
    cd "$SCRIPT_DIR/apps/hermes"
    pnpm generate-api-key "$ADMIN_EMAIL" "$KEY_NAME" --purpose general 2>&1
  )"
  REGISTRY_KEY="$(printf '%s\n' "$HERMES_OUTPUT" | extract_generated_api_key)"
  if [[ -z "$REGISTRY_KEY" ]]; then
    echo "  Failed to parse generated API key. Output:" >&2
    echo "$HERMES_OUTPUT" >&2
    exit 1
  fi
  echo "  Created new key and assigned to $AGENT_NAME."
fi

ENV_LOCAL="$AGENT_DIR/.env.local"
if [[ ! -f "$ENV_LOCAL" ]]; then
  touch "$ENV_LOCAL"
fi
upsert_env_var "$ENV_LOCAL" "AGENT_REGISTRY_API_KEY" "$REGISTRY_KEY"
echo "  ✓ Set AGENT_REGISTRY_API_KEY in $AGENT_DIR/.env.local"

section "Done"
echo "Agent $AGENT_NAME has .env and .env.local with correct values (PORT from example, AGENT_REGISTRY_API_KEY set)."
echo "Run: pnpm dev:agent-$AGENT_NAME"
