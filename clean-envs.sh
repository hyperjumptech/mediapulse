#!/bin/bash

# This script removes all .env and .env.local files anywhere in the project.
# Run from any directory; it always operates on the repo root (where this script lives).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Removing .env and .env.local files (from $SCRIPT_DIR)..."

# Delete both regular files and symlinks (dev-bootstrap creates symlinks)
find . -name ".env" \( -type f -o -type l \) -not -path "./.git/*" -delete
find . -name ".env.local" \( -type f -o -type l \) -not -path "./.git/*" -delete

echo "Done!"
