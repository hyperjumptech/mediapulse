#!/usr/bin/env bash
# Validate a Mermaid diagram file using the Mermaid CLI.
# Usage: bash scripts/validate.sh <file.mmd>
# Exit code 0 = valid, non-zero = syntax error (stderr has details).

set -euo pipefail

FILE="${1:?Usage: validate.sh <file.mmd>}"

if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE" >&2
  exit 1
fi

# Ensure mmdc is available
if ! command -v mmdc &>/dev/null; then
  echo "Installing @mermaid-js/mermaid-cli..." >&2
  npm install -g @mermaid-js/mermaid-cli >/dev/null 2>&1
fi

# Validate by rendering to SVG and discarding output
TMPOUT=$(mktemp /tmp/mermaid-validate-XXXXXX.svg)
trap 'rm -f "$TMPOUT"' EXIT

if mmdc -i "$FILE" -o "$TMPOUT" 2>&1; then
  echo "✓ Diagram is valid"
  exit 0
else
  echo "✗ Diagram has syntax errors (see above)" >&2
  exit 1
fi
