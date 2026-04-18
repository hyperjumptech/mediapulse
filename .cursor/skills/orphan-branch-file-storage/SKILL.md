---
name: orphan-branch-file-storage
description: Stores one or more files on a dedicated Git branch using a temporary worktree—creates an orphan branch (empty tree) when the branch is new, or updates an existing branch after pulling when a remote exists. Use when the user asks to save, stash, archive, or store files in an orphan branch, a branch with only certain files, or a file-storage branch in this repository.
---

# Orphan-branch file storage

## When to use

Apply when the user wants file(s) committed on a **named branch** that is either:

- **New**: an **orphan** branch (no shared history with `main`; only what you add), or
- **Existing**: the branch already exists locally or on the remote.

If the user does not name the branch, ask before running anything.

## Run the script (preferred)

From the **repository root**, execute:

```bash
.cursor/skills/orphan-branch-file-storage/scripts/orphan-branch-store.sh [options] <branch> [--] <path> [path ...]
```

Paths are **relative to the repo root** and must exist (files or directories). The script uses a temp worktree, copies paths in, commits, removes the worktree.

| Option             | Meaning                                        |
| ------------------ | ---------------------------------------------- |
| `-m` / `--message` | Commit message (default: `Store files`)        |
| `--remote`         | Remote name for fetch/push (default: `origin`) |
| `--push`           | Push after commit                              |
| `--allow-empty`    | Allow a commit with no paths                   |

**Push:** The script does **not** push unless `--push` is passed. If the user has **not** already said whether to push, **ask** them after a successful run; if they want to push, run from the repo root:

`git push -u <remote> <branch>`

**Preconditions:** Uncommitted changes in the main checkout must not block `git worktree add` (stash or commit elsewhere if needed).

** Details:** See [scripts/orphan-branch-store.sh](scripts/orphan-branch-store.sh) (new branch → `checkout --orphan` + empty index; existing → fetch/worktree + `pull --ff-only` when upstream exists).

## Notes

- **Orphan** means the first commit on that branch has no parent—good for storage-only branches.
- If the user wants a branch that **tracks** `main`, clarify; that is a different workflow.
