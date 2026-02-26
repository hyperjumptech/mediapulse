#!/usr/bin/env bash
#
# Scaffold a new Speed Docs MDX page and update meta.json.
#
# Usage:
#   scaffold-page.sh <content-dir> <path> <title> [description]
#
# Examples:
#   scaffold-page.sh ./docs guide/quickstart "Quick Start" "Get started fast"
#   scaffold-page.sh ./docs api/reference "API Reference"
#
# Arguments:
#   content-dir  Root content directory (e.g., ./docs)
#   path         Page path relative to docs/ (e.g., guide/quickstart)
#   title        Page title for frontmatter
#   description  Optional page description for frontmatter

set -euo pipefail

if [ $# -lt 3 ]; then
  echo "Usage: scaffold-page.sh <content-dir> <path> <title> [description]"
  echo ""
  echo "Examples:"
  echo "  scaffold-page.sh ./docs guide/quickstart \"Quick Start\" \"Get started fast\""
  echo "  scaffold-page.sh ./docs api/reference \"API Reference\""
  exit 1
fi

CONTENT_DIR="$1"
PAGE_PATH="$2"
TITLE="$3"
DESCRIPTION="${4:-}"

DOCS_DIR="${CONTENT_DIR}/docs"
FULL_PATH="${DOCS_DIR}/${PAGE_PATH}.mdx"
DIR_PATH=$(dirname "$FULL_PATH")
FILE_NAME=$(basename "$PAGE_PATH")

# Create directory if it doesn't exist
mkdir -p "$DIR_PATH"

# Check if file already exists
if [ -f "$FULL_PATH" ]; then
  echo "Error: File already exists at ${FULL_PATH}"
  exit 1
fi

# Build frontmatter
FRONTMATTER="---\ntitle: ${TITLE}"
if [ -n "$DESCRIPTION" ]; then
  FRONTMATTER="${FRONTMATTER}\ndescription: ${DESCRIPTION}"
fi
FRONTMATTER="${FRONTMATTER}\n---"

# Write the MDX file
printf "%b\n\n## %s\n\nStart writing your content here.\n" "$FRONTMATTER" "$TITLE" > "$FULL_PATH"

echo "Created: ${FULL_PATH}"

# Update or create meta.json in the parent directory
META_FILE="${DIR_PATH}/meta.json"

if [ -f "$META_FILE" ]; then
  # Check if the page is already in the meta.json pages array
  if command -v python3 &> /dev/null; then
    python3 -c "
import json, sys

with open('${META_FILE}', 'r') as f:
    meta = json.load(f)

pages = meta.get('pages', [])
slug = '${FILE_NAME}'

if slug not in pages:
    pages.append(slug)
    meta['pages'] = pages
    with open('${META_FILE}', 'w') as f:
        json.dump(meta, f, indent=2)
        f.write('\n')
    print(f'Updated: ${META_FILE} (added \"{slug}\")')
else:
    print(f'Skipped: \"{slug}\" already in ${META_FILE}')
"
  else
    echo "Warning: python3 not found. Please manually add \"${FILE_NAME}\" to ${META_FILE}"
  fi
else
  # Derive section title from directory name
  SECTION_NAME=$(basename "$DIR_PATH")
  SECTION_TITLE=$(echo "$SECTION_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')

  cat > "$META_FILE" << EOF
{
  "title": "${SECTION_TITLE}",
  "pages": ["${FILE_NAME}"]
}
EOF
  echo "Created: ${META_FILE}"
fi
