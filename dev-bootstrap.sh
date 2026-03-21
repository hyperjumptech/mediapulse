#!/bin/bash

# This script merges env.example files into a single .env and links every app/package
# workspace to that canonical env file in packages/shared/env.
#
# Options:
#   -f    Run clean-envs.sh first to remove existing .env and .env.local files.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$SCRIPT_DIR/apps"
packages_dir="$SCRIPT_DIR/packages"
env_pkg="$packages_dir/shared/env"

# Print a section header (title only, no underline)
section() { echo ""; echo "▸ $1"; echo ""; }
# Print a single linked target (relative path from repo root)
linked() { echo "  ✓ $1"; }

while getopts "f" opt; do
  case "$opt" in
    f)
      echo "Running clean-envs.sh..."
      "$SCRIPT_DIR/clean-envs.sh"
      ;;
    \?)
      echo "Usage: $0 [-f]" >&2
      echo "  -f  Run clean-envs.sh first (remove existing .env and .env.local)" >&2
      exit 1
      ;;
  esac
done
shift $((OPTIND - 1))

cd "$SCRIPT_DIR"

section "Env merge"
# Always merge example env into .env (preserves existing values, adds new keys, removes deleted keys)
"$env_pkg/merge-env-examples.sh" "$env_pkg/.env" 2>&1 | sed 's/^/  /'

section "Symlinks (.env → packages/shared/env/.env)"

# Domain app workspaces (non-agent apps)
for dir in "$app_dir/hermes"/* "$app_dir/mediapulse"/* "$app_dir/shared"/*; do
    if [[ -d "$dir" && "$(basename "$dir")" != "agents" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "$env_pkg/.env" ".env.local"
        ln -sf "$env_pkg/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

# Agent apps: .env → shared; .env.local → per-agent overrides (PORT, AGENT_PUBLIC_URL, AGENT_REGISTRY_API_KEY)
for dir in "$app_dir/mediapulse/agents"/*; do
    if [[ -d "$dir" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        agent_name="$(basename "$dir")"
        example_file="$env_pkg/env.agents.${agent_name}.example"
        cd "$dir"
        ln -sf "$env_pkg/.env" ".env"
        if [[ -f "$example_file" ]]; then
            # Remove .env.local if it's a symlink so we don't merge over shared .env (preserve only real dev overrides)
            [[ -L ".env.local" ]] && rm ".env.local"
            "$env_pkg/merge-agent-env.sh" "$example_file" ".env.local" 2>&1 | sed 's/^/  /' || true
            linked "$rel (.env + .env.local)"
        else
            ln -sf "$env_pkg/.env" ".env.local"
            linked "$rel"
        fi
        cd - >/dev/null
    fi
done

# Package workspaces under grouped roots (skip shared/env canonical source)
for dir in "$packages_dir/hermes"/* "$packages_dir/mediapulse"/* "$packages_dir/shared"/*; do
    if [[ -d "$dir" && "$dir" != "$env_pkg" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "$env_pkg/.env" ".env.local"
        ln -sf "$env_pkg/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

echo ""
echo "Done. Env is in packages/shared/env/.env; apps and packages are linked."