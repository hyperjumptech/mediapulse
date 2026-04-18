#!/usr/bin/env bash
# Store files on a branch using a temporary worktree.
# New branch (not on local or remote): orphan checkout + empty tree, then add files.
# Existing branch: worktree + optional ff-only pull when upstream exists.
set -euo pipefail

usage() {
  sed -n '1,40p' <<'EOF'
Usage: orphan-branch-store.sh [options] <branch> [--] <path-or-spec> [path-or-spec ...]

  Copies paths into a temporary worktree, commits on <branch>, removes the worktree.
  Inputs can be:
    - repo-relative path: docs/note.md (stored as docs/note.md)
    - absolute path: /tmp/note.md (stored as note.md at branch root)
    - explicit mapping: /tmp/note.md=archive/note.md

Options:
  -m, --message TEXT   Commit message (default: "Store files")
  --remote NAME        Remote to fetch/push (default: origin)
  --push               Push branch to remote after commit
  --allow-empty        Allow zero files (otherwise error)

Examples:
  ./orphan-branch-store.sh notes/backup -- docs/secret-notes.md
  ./orphan-branch-store.sh notes/backup -- /tmp/export.json
  ./orphan-branch-store.sh notes/backup -- /tmp/export.json=exports/2025/export.json
  ./orphan-branch-store.sh -m "Add export" --push archive/data -- exports/2025.tsv
EOF
}

MESSAGE="Store files"
REMOTE="origin"
PUSH=0
ALLOW_EMPTY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    -m | --message)
      MESSAGE="${2:?}"
      shift 2
      ;;
    --remote)
      REMOTE="${2:?}"
      shift 2
      ;;
    --push)
      PUSH=1
      shift
      ;;
    --allow-empty)
      ALLOW_EMPTY=1
      shift
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

BRANCH="${1:-}"
if [[ -z "$BRANCH" ]]; then
  echo "error: branch name required" >&2
  usage >&2
  exit 1
fi
shift
if [[ "${1:-}" == "--" ]]; then
  shift
fi

SPECS=("$@")

if [[ ${#SPECS[@]} -eq 0 && "$ALLOW_EMPTY" -ne 1 ]]; then
  echo "error: pass at least one path/spec, or --allow-empty" >&2
  exit 1
fi

REPO=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "error: not inside a git repository" >&2
  exit 1
}

realpath_portable() {
  python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

resolve_src_abs() {
  local src="$1"
  if [[ "$src" = /* ]]; then
    realpath_portable "$src"
  else
    realpath_portable "$REPO/$src"
  fi
}

normalize_dest_rel() {
  python3 -c '
import posixpath, sys
dest = sys.argv[1]
if not dest:
    print("error: empty destination path", file=sys.stderr)
    sys.exit(1)
if dest.startswith("/"):
    print(f"error: destination must be repo-relative: {dest}", file=sys.stderr)
    sys.exit(1)
norm = posixpath.normpath(dest)
if norm in (".", "") or norm.startswith("../"):
    print(f"error: destination escapes repo root: {dest}", file=sys.stderr)
    sys.exit(1)
print(norm)
' "$1"
}

# macOS dirname treats leading "-" as flags; Python avoids that.
parent_dir() {
  python3 -c 'import os,sys; p=os.path.dirname(sys.argv[1]); print(p if p else ".")' "$1"
}

WT_PATH=""
cleanup() {
  local ec=$?
  if [[ -n "${WT_PATH:-}" && -d "${WT_PATH:-}" ]]; then
    git -C "$REPO" worktree remove --force "$WT_PATH" 2>/dev/null || true
  fi
  exit "$ec"
}
trap cleanup EXIT INT HUP

cd "$REPO"

local_branch=0
remote_branch=0
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  local_branch=1
fi
if out=$(git ls-remote "$REMOTE" "refs/heads/$BRANCH" 2>/dev/null) && [[ -n "$out" ]]; then
  remote_branch=1
fi

WT_PATH=$(mktemp -d "${TMPDIR:-/tmp}/orphan-branch-wt.XXXXXX")

if [[ "$local_branch" -eq 0 && "$remote_branch" -eq 0 ]]; then
  git worktree add --detach "$WT_PATH" HEAD
  git -C "$WT_PATH" checkout --orphan "$BRANCH"
  git -C "$WT_PATH" rm -rf --quiet . 2>/dev/null || true
elif [[ "$local_branch" -eq 1 ]]; then
  git fetch "$REMOTE" "$BRANCH" 2>/dev/null || true
  git worktree add "$WT_PATH" "$BRANCH"
else
  git fetch "$REMOTE" "$BRANCH:refs/heads/$BRANCH"
  git worktree add "$WT_PATH" "$BRANCH"
fi

if git -C "$WT_PATH" rev-parse '@{u}' >/dev/null 2>&1; then
  if ! git -C "$WT_PATH" pull --ff-only; then
    echo "error: fast-forward pull failed; resolve upstream divergence manually" >&2
    exit 1
  fi
fi

for spec in "${SPECS[@]}"; do
  src="$spec"
  dest=""
  if [[ "$spec" == *"="* ]]; then
    src="${spec%%=*}"
    dest="${spec#*=}"
    if [[ -z "$src" || -z "$dest" ]]; then
      echo "error: invalid mapping spec (use source=dest): $spec" >&2
      exit 1
    fi
  fi

  src_abs=$(resolve_src_abs "$src")
  if [[ ! -e "$src_abs" ]]; then
    echo "error: missing source path: $src" >&2
    exit 1
  fi

  if [[ -z "$dest" ]]; then
    if [[ "$src" = /* ]]; then
      dest="$(basename "$src_abs")"
    else
      dest="$src"
    fi
  fi

  rel=$(normalize_dest_rel "$dest")
  par=$(parent_dir "$rel")
  if [[ -d "$src_abs" ]]; then
    mkdir -p "$WT_PATH/$par"
    rm -rf "${WT_PATH:?}/$rel"
    cp -R "$src_abs" "$WT_PATH/$rel"
  else
    mkdir -p "$WT_PATH/$par"
    cp "$src_abs" "$WT_PATH/$rel"
  fi
  git -C "$WT_PATH" add -f -- "$rel"
done

if [[ ${#SPECS[@]} -eq 0 && "$ALLOW_EMPTY" -eq 1 ]]; then
  git -C "$WT_PATH" commit --allow-empty -m "$MESSAGE"
elif git -C "$WT_PATH" diff --cached --quiet; then
  echo "error: no changes to commit" >&2
  exit 1
else
  git -C "$WT_PATH" commit -m "$MESSAGE"
fi

if [[ "$PUSH" -eq 1 ]]; then
  git -C "$WT_PATH" push -u "$REMOTE" "$BRANCH"
fi

git -C "$REPO" worktree remove "$WT_PATH"
WT_PATH=""
trap - EXIT INT HUP

echo "Committed on branch: $BRANCH"
if [[ "$PUSH" -eq 0 ]]; then
  echo "To push: git push -u $REMOTE $BRANCH"
fi
