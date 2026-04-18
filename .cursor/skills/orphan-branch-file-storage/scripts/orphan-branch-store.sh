#!/usr/bin/env bash
# Store repo-relative files on a branch using a temporary worktree.
# New branch (not on local or remote): orphan checkout + empty tree, then add files.
# Existing branch: worktree + optional ff-only pull when upstream exists.
set -euo pipefail

usage() {
  sed -n '1,40p' <<'EOF'
Usage: orphan-branch-store.sh [options] <branch> [--] <file> [file ...]

  Copies paths that exist under the repository root into a temporary worktree,
  commits on <branch>, removes the worktree.

Options:
  -m, --message TEXT   Commit message (default: "Store files")
  --remote NAME        Remote to fetch/push (default: origin)
  --push               Push branch to remote after commit
  --allow-empty        Allow zero files (otherwise error)

Examples:
  ./orphan-branch-store.sh notes/backup -- docs/secret-notes.md
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

FILES=("$@")

if [[ ${#FILES[@]} -eq 0 && "$ALLOW_EMPTY" -ne 1 ]]; then
  echo "error: pass at least one file under the repo root, or --allow-empty" >&2
  exit 1
fi

REPO=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "error: not inside a git repository" >&2
  exit 1
}

realpath_portable() {
  python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

path_under_repo() {
  local rel="$1"
  local abs
  abs=$(realpath_portable "$REPO/$rel")
  case "$abs" in
    "$REPO"/*) echo "${abs#"$REPO"/}" ;;
    "$REPO") echo "" ;;
    *)
      echo "error: path must stay inside repository: $rel" >&2
      return 1
      ;;
  esac
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

for f in "${FILES[@]}"; do
  if [[ ! -e "$f" ]]; then
    echo "error: missing path (relative to repo root): $f" >&2
    exit 1
  fi
  path_under_repo "$f" >/dev/null || exit 1
done

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

for f in "${FILES[@]}"; do
  rel=$(path_under_repo "$f")
  par=$(parent_dir "$rel")
  if [[ -d "$REPO/$rel" ]]; then
    mkdir -p "$WT_PATH/$par"
    rm -rf "${WT_PATH:?}/$rel"
    cp -R "$REPO/$rel" "$WT_PATH/$rel"
  else
    mkdir -p "$WT_PATH/$par"
    cp "$REPO/$rel" "$WT_PATH/$rel"
  fi
  git -C "$WT_PATH" add -f -- "$rel"
done

if [[ ${#FILES[@]} -eq 0 && "$ALLOW_EMPTY" -eq 1 ]]; then
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
