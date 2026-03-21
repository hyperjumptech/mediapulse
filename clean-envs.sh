#!/bin/bash

# Removes all .env and .env.local files anywhere in the project.
# Run from any directory; it always operates on the repo root (where this script lives).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Removing .env and .env.local files (from $SCRIPT_DIR)..."

backup_canonical_env() {
  local env_file="$1"
  if [[ -f "$env_file" && ! -L "$env_file" ]]; then
    local dir
    dir="$(dirname "$env_file")"
    local bak_name=".env.bak.$(date +%Y%m%d-%H%M%S)"
    cp "$env_file" "$dir/$bak_name"
    echo "Backed up $env_file to $dir/$bak_name"
  fi
}

backup_canonical_env "$SCRIPT_DIR/packages/hermes/env/.env"
backup_canonical_env "$SCRIPT_DIR/packages/mediapulse/env/.env"

# Delete .env everywhere (symlinks and the canonical file after backup)
find . -name ".env" \( -type f -o -type l \) -not -path "./.git/*" -delete
# Delete .env.local: all symlinks; real files only outside apps/mediapulse/agents (keep per-agent overrides)
find . -name ".env.local" -type l -not -path "./.git/*" -delete
find . -name ".env.local" -type f -not -path "./.git/*" -not -path "./apps/mediapulse/agents/*" -delete

echo "Done!"
