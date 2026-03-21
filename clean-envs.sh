#!/bin/bash

# This script removes all .env and .env.local files anywhere in the project.
# Run from any directory; it always operates on the repo root (where this script lives).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Removing .env and .env.local files (from $SCRIPT_DIR)..."

# Back up packages/shared/env/.env if it exists (real file, not symlink)
ENV_FILE="$SCRIPT_DIR/packages/shared/env/.env"
if [[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]]; then
  BAK_NAME=".env.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$ENV_FILE" "$SCRIPT_DIR/packages/shared/env/$BAK_NAME"
  echo "Backed up to packages/shared/env/$BAK_NAME"
fi

# Delete .env everywhere (symlinks and the canonical file after backup)
find . -name ".env" \( -type f -o -type l \) -not -path "./.git/*" -delete
# Delete .env.local: all symlinks; real files only outside apps/mediapulse/agents (keep per-agent overrides)
find . -name ".env.local" -type l -not -path "./.git/*" -delete
find . -name ".env.local" -type f -not -path "./.git/*" -not -path "./apps/mediapulse/agents/*" -delete

echo "Done!"
