#!/bin/bash

# This script is used to merge the environment variables from the env.example file and the env.*.example files into a single .env file and create symlinks for the environment variables in the apps and packages directories. The source of the environment variables is the .env file in the env package directory.
#
# Options:
#   -f    Run clean-envs.sh first to remove existing .env and .env.local files.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$SCRIPT_DIR/apps"
packages_dir="$SCRIPT_DIR/packages"

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
"$packages_dir/env/merge-env-examples.sh" "$packages_dir/env/.env" 2>&1 | sed 's/^/  /'

section "Symlinks (.env → packages/env/.env)"

# Loop through the subdirectories of the app directory
for dir in "$app_dir"/*; do
    if [[ -d "$dir" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "../../packages/env/.env" ".env.local"
        ln -sf "../../packages/env/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

# Loop through the subdirectories of the apps/agents directory
for dir in "$app_dir/agents"/*; do
    if [[ -d "$dir" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "../../../packages/env/.env" ".env.local"
        ln -sf "../../../packages/env/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

# Loop through the subdirectories of the packages directory (skip env — that’s where the canonical .env lives)
for dir in "$packages_dir"/*; do
    if [[ -d "$dir" && "$dir" != "$packages_dir/env" ]]; then
        rel="${dir#$SCRIPT_DIR/}"
        cd "$dir"
        ln -sf "../../packages/env/.env" ".env.local"
        ln -sf "../../packages/env/.env" ".env"
        linked "$rel"
        cd - >/dev/null
    fi
done

echo ""
echo "Done. Env is in packages/env/.env; apps and packages are linked."