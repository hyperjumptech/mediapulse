---
name: open-github-pr
description: Open a GitHub pull request for this repository using gh CLI, including branch checks, push, a reviewer-friendly PR body, and verified GitHub issue links (Closes/Fixes/Refs). Always resolve or create related issues before gh pr create so the PR can link to tickets; when drafting new issues, follow the create-github-issue skill for title and body structure. Use when the user asks to create/open/submit a PR or pull request, and format title and description with the pr-title-description skill structure (including Related issues).
---

# Open GitHub Pull Request

Create pull requests for this repo with `gh pr create`, and use the `/pr-title-description` structure for the title and body. **Do not run `gh pr create` until at least one related GitHub issue exists, is open, and is verified** (see **Mandatory: resolve or create issues before the PR**). Then include **`## Related issues`** with `Closes`/`Fixes`/`Refs` so the PR appears under each issue’s Development section.

**Creating or drafting GitHub issues** (title, body sections, `gh issue create`): use [create-github-issue](../create-github-issue/SKILL.md).

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

### Mandatory: resolve or create issues before the PR

**Hard gate:** do not draft the final PR body or run `gh pr create` until every issue you will reference is **real, open, and verified** (`gh issue view`). If no suitable issue exists yet, **draft and create** it first, then verify.

Run this **after** you have the same `<base>` used for `git diff <base>...HEAD` (so the issue description can reflect the actual change set).

1. **Discover**
   - **From the work** — branch name (`…/mp-142-…`), ticket filename from [`prd-to-tickets`](../prd-to-tickets/SKILL.md) / Linear export, or the user’s stated IDs.
   - **From the repo** — `gh issue list --repo "<owner>/<repo>" --limit 20` (or search: `gh issue list --search "title text"`). Use the same `--repo` / host / account context as in the workflow’s first step.
   - **Same repo** — you will use `#123` in the PR body. **Other repo** — use `owner/other-repo#123` or a full issue URL in **`## Related issues`** (only when the user explicitly tracks work there—see **Cross-repo / external tracking** below).

2. **Select or create**
   - If one or more issues clearly match: run `gh issue view <n|url> --repo "<owner>/<repo>" --json number,state,title,url` and require **`state` is `OPEN`**. If the issue is closed, stop and resolve with the user (reopen, new issue, or different ticket)—do not open a PR that only links to a closed issue unless they explicitly want that.
   - If **no** suitable open issue exists in this repo (and the user did not point to external-repo-only tracking): **draft** an issue whose title aligns with the upcoming PR title intent and whose body follows [create-github-issue](../create-github-issue/SKILL.md) (Summary, Scope, Acceptance criteria, Dependencies, Notes)—grounded in `git diff <base>...HEAD` and the commit story, not an empty placeholder. Create with **`gh issue create --repo "<owner>/<repo>" -t "..." --body-file "$ISSUE_FILE"`**, where **`$ISSUE_FILE`** is from **`mktemp`** under the system temp dir only, with **`trap 'rm -f "$ISSUE_FILE"' EXIT`** (same rules as PR bodies—**never** write under the clone). Add **`-l name`** when team conventions or the user specify labels.

3. **Capture number** — `gh issue create` prints the new issue URL. Resolve the number reliably:  
   `ISSUE_NUM="$(gh issue view "<printed-url>" --repo "<owner>/<repo>" --json number -q .number)"`  
   (or use the number from `gh issue view` after create). Use that `#N` in the PR body.

4. **Verify before `gh pr create`** — For **each** issue you will reference, run `gh issue view` again (`number` or `url`) and confirm **`state` is `OPEN`** and the title still matches expectations. Only then proceed to draft the PR and **`gh pr create`**.

### Cross-repo / external tracking

If the user **explicitly** says work is tracked in **another** repository, **do not** auto-create a duplicate issue in the current repo. Put `owner/other-repo#N` or the full URL under **`## Related issues`** with the appropriate `Closes` / `Fixes` / `Refs` keywords, and still **verify** with `gh issue view <url>` (needs access to that repo). The **`## Related issues`** section remains mandatory; only the “create in this repo” step is skipped.

If the user explicitly confirms **external-repo-only** tracking, the PR body must still contain the linking keywords—there is no PR without a verified link target.

### Keywords (pick intentionally)

| Intent                                                                                   | In the PR body (example)                                   | Effect                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| This PR **finishes** the ticket when merged (usual single PR or **final** stack layer)   | `Closes #123`, `Fixes #123`, or `Resolves #123`            | Issue auto-closes when the PR is merged (per [repo merge settings](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)) |
| Link the PR to the ticket **without** closing yet (common for **non-final** stacked PRs) | `Refs #123` or `Ref #123`                                  | Linked in Development; does not close on merge                                                                                                                           |
| Multiple tickets                                                                         | One line each or bullets, e.g. `Closes #10` and `Refs #11` | Same rules per line                                                                                                                                                      |

Place keywords in **`## Related issues`** (recommended) or in **`## Summary`** so they are easy to find. **Do not** rely on the title alone—titles do not create the same development linkage as body/commit keywords.

### Stacked PRs + tickets

- **Every stacked PR layer** must still satisfy **Mandatory: resolve or create issues before the PR** (verified open issue(s))—only the **`Refs` vs `Closes` / `Fixes`** choice changes by layer, not whether an issue exists first.
- **One ticket, multiple PRs in a stack:** Use **`Refs #N`** on every layer that is not the last merge to the default branch; use **`Closes #N`** (or **`Fixes`**) only on the PR that should complete the ticket when merged (often the **top** of the stack once it targets `main`, or the single PR that delivers the remaining work—align with your team). If every layer used `Closes #N`, the issue could close too early when an intermediate PR merges.
- **One ticket per PR in the stack:** Each PR body should **`Closes`** (or **`Fixes`**) **its** issue only.

If unsure whether intermediate merges close issues in your org, prefer **`Refs`** until the final PR, then **`Closes`** there.

### When issue creation fails

`gh issue create` needs write access to the repo (and correct `gh auth switch` / token scopes). If creation fails, **do not** open the PR until the user fixes auth, creates the issue manually and supplies a number/URL, or grants access—then run **`gh issue view`** and continue from step 4 of the mandatory gate.

## PR body: prefer `--body-file`

**Do not pass the description with `--body "$PR_BODY"`** when a shell or IDE wrapper may append a footer (for example `Made with [Cursor](https://cursor.com)`). That injection can happen **after** your variable is built, so in-line sanitization never sees it.

**Do this instead:**

1. Create a **system temp file** with `mktemp` (uses `$TMPDIR` on macOS, `/tmp` when unset — **never** write PR bodies under the repo, e.g. do not use `.cursor/tmp-pr-body.md`, which pollutes `git status`).
2. Register cleanup so the file is always removed: `trap 'rm -f "$BODY_FILE"' EXIT` (and after a successful `gh pr create`, you may `rm -f "$BODY_FILE"` and `trap - EXIT` if you want it gone before the shell exits).
3. Write the markdown to that path, then run `gh pr create ... --body-file "$BODY_FILE"`.

Verify the published body with `gh pr view --json body` as usual. The temp file should not remain on disk after the workflow finishes.

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

5. **Resolve or create related issues, then open the PR** — Run **Mandatory: resolve or create issues before the PR** (same `<base>` / `--repo` / auth as the main workflow). Then create the PR using **`--body-file`** with `--repo`, `--base`, and `--head` as needed.

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
5. **Resolve or create related GitHub issue(s)** — Follow **Mandatory: resolve or create issues before the PR** (discover → select or create with `--body-file` + `mktemp` when creating → capture number → verify each issue is **OPEN**). Do not continue until you have stable issue number(s) or URL(s) for every line that will appear under **`## Related issues`**.
6. Draft PR content using `/pr-title-description`:
   - Title: short, imperative, verb-first.
   - **`## Related issues` is always mandatory.** Use `#N` for this repo, or `owner/repo#N` / full URLs when work is tracked elsewhere (**Cross-repo / external tracking**). Include `Refs`/`Closes`/`Fixes` per **Stacked PRs + tickets** so GitHub links the PR.
   - Description sections:
     - `## Summary`
     - `## Related issues` — at least one verified line with `Closes`/`Fixes`/`Refs` (or cross-repo form).
     - `## Important changes`
     - `## Other changes`
     - `## Key files to review`
     - `## How to test`
7. Create PR in one shot with a **body file** (no post-create edits for footer cleanup):
   - Create a temp file with `mktemp` under the system temp directory only; use the template below (not a path inside the clone).
   - Write the full markdown to `$BODY_FILE`. Remove any accidental signature lines if they appear (for example lines matching `Made with [Cursor](https://cursor.com)` or `Made with Cursor`).
   - `gh pr create --repo "<owner>/<repo>" --title "..." --body-file "$BODY_FILE"`
   - Add `--base <base>` when the PR must not target the repo default (stacked branches). Add `--head <head>` if the head branch name is not inferred correctly (e.g. fork or multiple remotes).
   - When verification (step 8) finishes in the same shell, exiting the shell runs the `trap` and deletes the file. If you run `gh` in separate tool invocations without a persistent shell, run `rm -f "$BODY_FILE"` after step 8.

```bash
# Prerequisites: Steps 1–5 completed — related issues exist, are OPEN, and verified via gh issue view.
# Set BASE to the parent branch for stacked PRs, or the repo default for the root of the stack.
# Example (Git Town): BASE="$(git town config get-parent)"
# Example (single PR off main): BASE="main"  # or output of gh repo view --json defaultBranchRef ...

BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/gh-pr-body.XXXXXX")"
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

8. Verify body after create (read-only check only):
   - Fetch body: `gh pr view --repo "<owner>/<repo>" --json number,body --jq '.body'`
   - Confirm it does **not** contain `Made with [Cursor](https://cursor.com)` or `Made with Cursor`.
   - Confirm the body still contains the intended `Closes`/`Fixes`/`Refs` lines (GitHub parses these from the merged body text).
   - Do **not** run `gh pr edit` for footer cleanup; if cleanup is needed, close/recreate so final PR is not marked edited.
9. Return the PR URL and a short test note (mention `<base>` → `<head>` if useful for reviewers).

## Quality checklist

- PR title starts with a verb and has no trailing period.
- **Related issues:** Before `gh pr create`, every referenced issue was verified **OPEN** via `gh issue view`. If an issue was created in-session, it used **`gh issue create`** with **`--body-file`** and a **`mktemp`** path (plus `trap` cleanup), never a path inside the repo.
- **No PR without a link target:** The PR body includes **`## Related issues`** with at least one `Closes`/`Fixes`/`Refs` line (`#N` same repo, or `owner/repo#N` / URL for external tracking after explicit exemption from creating a duplicate in this repo).
- Description follows `/pr-title-description` sections, with **`## Related issues`** immediately after **Summary**.
- Do not include any signature/footer such as `Made with Cursor` in the PR title or body.
- Body is supplied via **`--body-file`** so automated footers are not injected into `--body`; the body file is created with **`mktemp`** under the system temp dir and **removed** (`trap` and/or explicit `rm`), never left as `.cursor/tmp-pr-body.md` (or any path inside the repo).
- After creation, run a read-only body verification check (no `gh pr edit` footer cleanup).
- High-risk behavior and reviewer-critical files are explicitly called out.
- Test steps are concrete and include expected outcomes.
- The command uses `--repo <owner>/<repo>` and a verified account context (`gh auth switch -h <host> -u <account>` + `gh api` access check).
- **Stacked PRs:** `--base` matches the real parent branch (`git town config get-parent` or equivalent); `git diff <base>...HEAD` matches what GitHub will show; each layer still has verified issue(s), using **`Refs`** until the appropriate final PR uses **`Closes`/`Fixes`** so issues are not closed prematurely.
