#!/usr/bin/env bash
# Merges an agent env example file into a target .env.local file.
# Usage: merge-agent-env.sh <example-file> <output-file>
# If output-file exists, existing values are preserved; new keys from the example
# are added. Used so each agent app can have its own .env.local with agent-specific
# overrides (e.g. PORT, AGENT_PUBLIC_URL, AGENT_REGISTRY_API_KEY) while sharing
# the rest from packages/mediapulse/env/.env. Portable for bash 3 (e.g. macOS default).

set -euo pipefail

EXAMPLE_FILE="${1:?Usage: merge-agent-env.sh <example-file> <output-file>}"
OUTPUT_FILE="${2:?Usage: merge-agent-env.sh <example-file> <output-file>}"

[[ ! -f "$EXAMPLE_FILE" ]] && { echo "Example file not found: $EXAMPLE_FILE" >&2; exit 1; }

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

pending_comment=""
: > "$TMPDIR/keys"

while IFS= read -r line || [[ -n "${line:-}" ]]; do
  if [[ "$line" =~ ^[[:space:]]*# ]]; then
    pending_comment="$line"
  elif [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
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
done < "$EXAMPLE_FILE"

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
fi

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
