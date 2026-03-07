#!/usr/bin/env bash
# Combines variables from env.example and all env.*.example files into a single .env.
# Base file env.example is processed first; other env.*.example files add variables.
# For keys present in multiple files, the value from the first file that defined
# the key is kept (env.example wins for overlapping keys).
# Portable for bash 3 (e.g. macOS default).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${1:-$SCRIPT_DIR/.env}"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

pending_comment=""
# Keys in order of first appearance
: > "$TMPDIR/keys"

process_file() {
  local file="$1"
  [[ ! -f "$file" ]] && return 0
  while IFS= read -r line || [[ -n "${line:-}" ]]; do
    if [[ "$line" =~ ^[[:space:]]*# ]]; then
      pending_comment="$line"
    elif [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      # Only set if not already set (first occurrence wins)
      if [[ ! -f "$TMPDIR/v/$key" ]]; then
        mkdir -p "$TMPDIR/v" "$TMPDIR/c"
        printf '%s' "$value" > "$TMPDIR/v/$key"
        printf '%s' "$pending_comment" > "$TMPDIR/c/$key"
        echo "$key" >> "$TMPDIR/keys"
      fi
      pending_comment=""
    elif [[ "$line" =~ ^[[:space:]]*$ ]]; then
      pending_comment=""
    fi
  done < "$file"
}

# Process env.example first (base), then other env.*.example in sorted order
process_file "$SCRIPT_DIR/env.example"
while IFS= read -r -d '' f; do
  process_file "$f"
done < <(find "$SCRIPT_DIR" -maxdepth 1 -name 'env.*.example' -print0 | sort -z)

# Write merged output
mkdir -p "$(dirname "$OUTPUT_FILE")"
: > "$OUTPUT_FILE"
while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  if [[ -f "$TMPDIR/c/$key" ]]; then
    comment="$(cat "$TMPDIR/c/$key")"
    [[ -n "$comment" ]] && echo "$comment" >> "$OUTPUT_FILE"
  fi
  printf '%s=' "$key" >> "$OUTPUT_FILE"
  cat "$TMPDIR/v/$key" >> "$OUTPUT_FILE"
  echo >> "$OUTPUT_FILE"
done < "$TMPDIR/keys"

echo "Merged env written to $OUTPUT_FILE"
