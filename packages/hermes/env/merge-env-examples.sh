#!/usr/bin/env bash
# Combines variables from env.example and all env.*.example files into a single .env.
# Base file env.example is processed first; other env.*.example files add variables.
# If .env already exists: existing values are preserved; new keys from examples are
# added; keys no longer present in examples are removed. Reports what was added/removed.
# Portable for bash 3 (e.g. macOS default).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${1:-$SCRIPT_DIR/.env}"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

pending_comment=""
# Keys in order of first appearance (from example files)
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

# Parse existing .env if present (preserve values for keys we'll keep)
if [[ -f "$OUTPUT_FILE" ]]; then
  mkdir -p "$TMPDIR/existing"
  : > "$TMPDIR/existing_keys"
  while IFS= read -r line || [[ -n "${line:-}" ]]; do
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      printf '%s' "$value" > "$TMPDIR/existing/$key"
      echo "$key" >> "$TMPDIR/existing_keys"
    fi
  done < "$OUTPUT_FILE"
  sort -u "$TMPDIR/existing_keys" 2>/dev/null > "$TMPDIR/existing_keys_sorted" || true
fi

# Process env.example first (base), then other env.*.example in sorted order
process_file "$SCRIPT_DIR/env.example"
while IFS= read -r -d '' f; do
  process_file "$f"
done < <(find "$SCRIPT_DIR" -maxdepth 1 -name 'env.*.example' -print0 | sort -z)

# Canonical key set from examples (for "removed" check)
sort -u "$TMPDIR/keys" 2>/dev/null > "$TMPDIR/canonical_keys" || true

# Determine added and removed
added=()
removed=()
if [[ -f "$TMPDIR/existing_keys_sorted" ]]; then
  while IFS= read -r key; do
    [[ -z "$key" ]] && continue
    if ! grep -qFx "$key" "$TMPDIR/canonical_keys" 2>/dev/null; then
      removed+=("$key")
    fi
  done < "$TMPDIR/existing_keys_sorted"
fi
while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  if [[ ! -f "$TMPDIR/existing/$key" ]] 2>/dev/null; then
    added+=("$key")
  fi
done < "$TMPDIR/keys"

# Write merged output: canonical keys in example order; use existing value if present
mkdir -p "$(dirname "$OUTPUT_FILE")"
: > "$OUTPUT_FILE"
while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  if [[ -f "$TMPDIR/c/$key" ]]; then
    comment="$(cat "$TMPDIR/c/$key")"
    [[ -n "$comment" ]] && echo "$comment" >> "$OUTPUT_FILE"
  fi
  printf '%s=' "$key" >> "$OUTPUT_FILE"
  if [[ -f "$TMPDIR/existing/$key" ]]; then
    cat "$TMPDIR/existing/$key" >> "$OUTPUT_FILE"
  else
    cat "$TMPDIR/v/$key" >> "$OUTPUT_FILE"
  fi
  echo >> "$OUTPUT_FILE"
done < "$TMPDIR/keys"

# Report changes
if [[ "$OUTPUT_FILE" == "$SCRIPT_DIR/.env" ]]; then
  echo "Merged env written to packages/hermes/env/.env"
else
  echo "Merged env written to $OUTPUT_FILE"
fi
if [[ ${#added[@]} -gt 0 ]]; then
  echo "Added:"
  for key in "${added[@]}"; do
    echo "  · $key"
  done
fi
if [[ ${#removed[@]} -gt 0 ]]; then
  echo "Removed:"
  for key in "${removed[@]}"; do
    echo "  · $key"
  done
fi
if [[ ${#added[@]} -eq 0 && ${#removed[@]} -eq 0 ]]; then
  echo "No structural changes (existing values preserved)."
fi
