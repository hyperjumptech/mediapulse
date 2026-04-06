---
name: open-github-pr
description: Open a GitHub pull request for this repository using gh CLI, including branch checks, push, a reviewer-friendly PR body, and GitHub issue links (Closes/Fixes/Refs) so PRs connect to tickets. Use when the user asks to create/open/submit a PR or pull request, and format title and description with the pr-title-description skill structure (plus Related issues when applicable).
---

# Open GitHub Pull Request

Create pull requests for this repo with `gh pr create`, and use the `/pr-title-description` structure for the title and body. When work maps to GitHub issues, include **`## Related issues`** with `Closes`/`Fixes`/`Refs` (see **Link PRs to GitHub issues**) so the PR appears under each issue’s Development section.

## When to use this skill

- User asks to open/create/submit a GitHub PR.
- User asks to draft or publish a pull request from current changes.
- User asks for PR title/description generation for the current branch.
- User asks to land skill-only or docs-only changes via a **separate worktree** (branch, push, PR, then remove the worktree).
- The branch is part of a **stack** ([Git Town](https://www.git-town.com/) or another stacked workflow) where the PR must target the **parent branch**, not the repo default.

## Stacked branches: set `--base` to the parent (not always `main`)

For **stacked changes**, GitHub must compare the head branch to the **correct base**. If you omit `--base`, `gh pr create` uses the repository **default branch** (often `main`), which is wrong for every layer above the bottom of the stack: reviewers see unrelated commits, and the diff is misleading.

**Resolve the PR base before** `git diff …` and `gh pr create`:

1. **Git Town** — parent of the current branch is the PR base:
   - `git town config get-parent`  
     (optional: `git town config get-parent <branch>`).  
     If Git Town is not installed or the command fails, infer the parent another way.
2. **Repo default** — only the **root** of a stack usually targets the default branch. Confirm with `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name` when you need the name explicitly.
3. **Manual / non–Git-Town stacks** — use the branch you actually branched from (the dependency), or `git merge-base` / `git log --first-parent` against candidates until the diff matches what should be reviewed.

Then:

- Review range: `git diff <base>...HEAD` (three-dot), not `git diff main...HEAD` unless `<base>` **is** `main`.
- Create: `gh pr create ... --base <base> --head <head>` when `<base>` is not the default branch, or pass `--base` whenever you want to be explicit.

See [git-town-stacked-changes](../git-town-stacked-changes/SKILL.md) for stack ordering, sync, and merge order. After a lower PR merges, **retarget** the next PR to `main` (or run Git Town sync) per your workflow—do not assume the base stays the old parent forever.

## Link PRs to GitHub issues (tickets)

GitHub connects a PR to issues when the **body or commits** contain recognized references. PRs opened with this skill must **actively include** those references—otherwise the Development panel stays empty and nothing links “ticket → PR.”

### Resolve issue numbers before drafting the body

1. **From the work** — branch name (`…/mp-142-…`), ticket filename from `prd-to-tickets` / Linear export, or the user’s stated IDs.
2. **From the repo** — `gh issue list --repo "<owner>/<repo>" --limit 20` (or search: `gh issue list --search "title text"`).
3. **Same repo** — use `#123`. **Other repo** — use `owner/other-repo#123` or a full issue URL (GitHub still links and tracks development when the keyword is present).

### Keywords (pick intentionally)

| Intent                                                                                   | In the PR body (example)                                   | Effect                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| This PR **finishes** the ticket when merged (usual single PR or **final** stack layer)   | `Closes #123`, `Fixes #123`, or `Resolves #123`            | Issue auto-closes when the PR is merged (per [repo merge settings](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)) |
| Link the PR to the ticket **without** closing yet (common for **non-final** stacked PRs) | `Refs #123` or `Ref #123`                                  | Linked in Development; does not close on merge                                                                                                                           |
| Multiple tickets                                                                         | One line each or bullets, e.g. `Closes #10` and `Refs #11` | Same rules per line                                                                                                                                                      |

Place keywords in **`## Related issues`** (recommended) or in **`## Summary`** so they are easy to find. **Do not** rely on the title alone—titles do not create the same development linkage as body/commit keywords.

### Stacked PRs + tickets

- **One ticket, multiple PRs in a stack:** Use **`Refs #N`** on every layer that is not the last merge to the default branch; use **`Closes #N`** (or **`Fixes`**) only on the PR that should complete the ticket when merged (often the **top** of the stack once it targets `main`, or the single PR that delivers the remaining work—align with your team). If every layer used `Closes #N`, the issue could close too early when an intermediate PR merges.
- **One ticket per PR in the stack:** Each PR body should **`Closes`** (or **`Fixes`**) **its** issue only.

If unsure whether intermediate merges close issues in your org, prefer **`Refs`** until the final PR, then **`Closes`** there.

## PR body: prefer `--body-file`

**Do not pass the description with `--body "$PR_BODY"`** when a shell or IDE wrapper may append a footer (for example `Made with [Cursor](https://cursor.com)`). That injection can happen **after** your variable is built, so in-line sanitization never sees it.

**Do this instead:**

1. Write the markdown to a file (temp file or repo-relative path).
2. Run `gh pr create ... --body-file /path/to/description.md`.
3. Optionally delete the temp file after success.

Verify the published body with `gh pr view --json body` as usual.

## Optional: skill or docs changes in a dedicated worktree

Use when you want a clean branch off `main` (or another base) without disturbing the user’s current worktree—common for `.cursor/skills/`, rules, or dev-docs edits.

Run from the **primary repository** clone (the one that owns the worktrees), not from inside an existing linked worktree if you can avoid it.

1. **Fetch the base branch**  
   `git fetch origin <base>` (e.g. `main`).

2. **Add a worktree and create a branch**  
   `git worktree add <path> -b <branch-name> origin/<base>`  
   Example:  
   `git worktree add ../mediapulse-worktree/my-skill-branch -b docs/update-foo-skill origin/main`

3. **Work only in that directory**  
   Apply commits there (`cd <path>`).

4. **Publish**  
   `git push -u origin HEAD`

5. **Open the PR** using **`--body-file`** (see above), with `--repo`, `--base`, and `--head` as needed.

6. **Remove the worktree** (branch stays on `origin`; the PR remains open)  
   From the primary repo:  
   `git worktree remove <path>`  
   If Git reports the path is locked or dirty, commit or stash in that worktree first, then retry. Use `git worktree prune` only if Git leaves stale metadata.

7. **Mirror user-global skills** (if the repo ships skills under `.cursor/skills/` and the user also keeps copies under `~/.cursor/skills/`): update both so local invocations match the merged repo version.

## Workflow (run in order)

1. Resolve repository slug, host, and account context first:
   - Parse `origin` remote to get `host`, `owner`, and `repo`.
   - If the remote uses an SSH alias host (example: `github.com-somealias`), map it to the real API host (`github.com`) before calling `gh`.
   - Determine target account from owner mapping (for example from shell mapping like `GH_OWNER_ACCOUNT`), then switch explicitly:
     - `gh auth switch -h <host> -u <account>`
   - Verify access before continuing:
     - `gh api --hostname <host> repos/<owner>/<repo>`
2. **Resolve the PR base branch** `<base>` (see **Stacked branches** above if this is a stacked branch). Do not assume `main`.
3. Confirm branch status and pending changes:
   - `git status`
   - `git diff`
   - `git log --oneline -n 10`
   - `git diff <base>...HEAD` (three-dot diff against the **same** base you will pass to `gh pr create --base`)
4. Ensure the branch exists and is pushed:
   - If needed, create/switch to feature branch.
   - Push with upstream tracking: `git push -u origin HEAD`.
5. Draft PR content using `/pr-title-description`:
   - Title: short, imperative, verb-first.
   - **Resolve GitHub issue numbers** for this PR (see **Link PRs to GitHub issues** above). If the work came from tickets, the body must include `Refs`/`Closes`/`Fixes` lines so GitHub links the PR.
   - Description sections:
     - `## Summary`
     - `## Related issues` (when any ticket/issue applies — include `Closes`/`Fixes`/`Refs` lines; omit the section only if there is truly no tracking issue)
     - `## Important changes`
     - `## Other changes`
     - `## Key files to review`
     - `## How to test`
6. Create PR in one shot with a **body file** (no post-create edits for footer cleanup):
   - Write the full markdown to a file; use the template below.
   - Remove any accidental signature lines from the file if they appear (for example lines matching `Made with [Cursor](https://cursor.com)` or `Made with Cursor`).
   - `gh pr create --repo "<owner>/<repo>" --title "..." --body-file /path/to/body.md`
   - Add `--base <base>` when the PR must not target the repo default (stacked branches). Add `--head <head>` if the head branch name is not inferred correctly (e.g. fork or multiple remotes).

```bash
# Set BASE to the parent branch for stacked PRs, or the repo default for the root of the stack.
# Example (Git Town): BASE="$(git town config get-parent)"
# Example (single PR off main): BASE="main"  # or output of gh repo view --json defaultBranchRef ...

BODY_FILE="$(mktemp -t gh-pr-body)"
trap 'rm -f "$BODY_FILE"' EXIT

cat <<'EOF' >"$BODY_FILE"
## Summary

1-3 sentences on what changed and why.

## Related issues

Closes #123

## Important changes

- High-impact behavior/API/UX change.
- Another critical change reviewers should verify.

## Other changes

- Smaller refactor/config/doc updates.

## Key files to review

- `path/to/file.ts` - why it matters.
- `path/to/file.test.ts` - key assertions to verify.

## How to test

1. Run the relevant command(s).
2. Execute feature flow in app/API.
3. Confirm expected result and edge case behavior.
EOF

gh pr create --repo "<owner>/<repo>" --base "$BASE" --title "Add concise verb-first title" --body-file "$BODY_FILE"
```

Set `BASE` before this command so it matches the three-dot range in step 3: **stacked PRs** → parent from `git town config get-parent` (or equivalent); **root of stack or single PR** → repo default branch name (same as `gh repo view --json defaultBranchRef`). Passing `--base "$BASE"` when `BASE` is the default branch is equivalent to omitting `--base` but keeps diff and PR creation in sync.

7. Verify body after create (read-only check only):
   - Fetch body: `gh pr view --repo "<owner>/<repo>" --json number,body --jq '.body'`
   - Confirm it does **not** contain `Made with [Cursor](https://cursor.com)` or `Made with Cursor`.
   - If tickets apply, confirm the body still contains the intended `Closes`/`Fixes`/`Refs` lines (GitHub parses these from the merged body text).
   - Do **not** run `gh pr edit` for footer cleanup; if cleanup is needed, close/recreate so final PR is not marked edited.
8. Return the PR URL and a short test note (mention `<base>` → `<head>` if useful for reviewers).

## Quality checklist

- PR title starts with a verb and has no trailing period.
- Description follows `/pr-title-description` sections, with **`## Related issues`** inserted after **Summary** when work is tracked in GitHub issues.
- Do not include any signature/footer such as `Made with Cursor` in the PR title or body.
- Body is supplied via **`--body-file`** so automated footers are not injected into `--body`.
- After creation, run a read-only body verification check (no `gh pr edit` footer cleanup).
- High-risk behavior and reviewer-critical files are explicitly called out.
- Test steps are concrete and include expected outcomes.
- The command uses `--repo <owner>/<repo>` and a verified account context (`gh auth switch -h <host> -u <account>` + `gh api` access check).
- **Stacked PRs:** `--base` matches the real parent branch (`git town config get-parent` or equivalent); `git diff <base>...HEAD` matches what GitHub will show.
- **Tickets:** Body includes **`## Related issues`** with at least one `Closes`/`Fixes`/`Refs` line (or cross-repo `owner/repo#N`) when work is tracked in GitHub; stacked layers use `Refs` until the appropriate final PR uses `Closes`/`Fixes` so issues are not closed prematurely.
