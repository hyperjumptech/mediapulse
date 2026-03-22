#!/bin/bash

# Merges env.example files into each domain env package, then symlinks apps and
# packages to the correct canonical .env (Hermes vs Mediapulse).
#
# Options:
#   -f    Run clean-envs.sh first to remove existing .env and .env.local files.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$SCRIPT_DIR/apps"
packages_dir="$SCRIPT_DIR/packages"
env_hermes_pkg="$packages_dir/hermes/env"
env_mediapulse_pkg="$packages_dir/mediapulse/env"

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

section "Env merge (Hermes)"
"$env_hermes_pkg/merge-env-examples.sh" "$env_hermes_pkg/.env" 2>&1 | sed 's/^/  /'

section "Env merge (Mediapulse)"
"$env_mediapulse_pkg/merge-env-examples.sh" "$env_mediapulse_pkg/.env" 2>&1 | sed 's/^/  /'

section "Symlinks — Hermes apps (.env → packages/hermes/env/.env)"

for dir in "$app_dir/hermes"/*; do
    if [[ -d "$dir" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "$env_hermes_pkg/.env" ".env.local"
        ln -sf "$env_hermes_pkg/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

section "Symlinks — Mediapulse apps (non-agent)"

for dir in "$app_dir/mediapulse"/*; do
    if [[ -d "$dir" && "$(basename "$dir")" != "agents" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "$env_mediapulse_pkg/.env" ".env.local"
        ln -sf "$env_mediapulse_pkg/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

section "Symlinks — Mediapulse agents (.env shared; .env.local per agent)"

for dir in "$app_dir/mediapulse/agents"/*; do
    if [[ -d "$dir" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        agent_name="$(basename "$dir")"
        example_file="$env_mediapulse_pkg/env.agents.${agent_name}.example"
        cd "$dir"
        ln -sf "$env_mediapulse_pkg/.env" ".env"
        if [[ -f "$example_file" ]]; then
            [[ -L ".env.local" ]] && rm ".env.local"
            "$env_mediapulse_pkg/merge-agent-env.sh" "$example_file" ".env.local" 2>&1 | sed 's/^/  /' || true
            linked "$rel (.env + .env.local)"
        else
            ln -sf "$env_mediapulse_pkg/.env" ".env.local"
            linked "$rel"
        fi
        cd - >/dev/null
    fi
done

section "Symlinks — apps/shared"

for dir in "$app_dir/shared"/*; do
    if [[ -d "$dir" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "$env_mediapulse_pkg/.env" ".env.local"
        ln -sf "$env_mediapulse_pkg/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

section "Symlinks — packages/hermes (except env package)"

for dir in "$packages_dir/hermes"/*; do
    if [[ -d "$dir" && "$dir" != "$env_hermes_pkg" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "$env_hermes_pkg/.env" ".env.local"
        ln -sf "$env_hermes_pkg/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

section "Symlinks — packages/mediapulse (except env package)"

for dir in "$packages_dir/mediapulse"/*; do
    if [[ -d "$dir" && "$dir" != "$env_mediapulse_pkg" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "$env_mediapulse_pkg/.env" ".env.local"
        ln -sf "$env_mediapulse_pkg/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

section "Symlinks — packages/shared"

for dir in "$packages_dir/shared"/*; do
    if [[ -d "$dir" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "$env_mediapulse_pkg/.env" ".env.local"
        ln -sf "$env_mediapulse_pkg/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

echo ""
echo "Done. Hermes env: packages/hermes/env/.env; Mediapulse env: packages/mediapulse/env/.env"
