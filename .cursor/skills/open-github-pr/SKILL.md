---
name: open-github-pr
description: Open a GitHub pull request for this repository using gh CLI, including branch checks, push, and a reviewer-friendly PR body. Use when the user asks to create/open/submit a PR or pull request, and format title and description with the pr-title-description skill structure.
---

# Open GitHub Pull Request

Create pull requests for this repo with `gh pr create`, and use the `/pr-title-description` structure for the title and body.

## When to use this skill

- User asks to open/create/submit a GitHub PR.
- User asks to draft or publish a pull request from current changes.
- User asks for PR title/description generation for the current branch.

## Workflow (run in order)

1. Confirm branch status and pending changes:
   - `git status`
   - `git diff`
   - `git log --oneline -n 10`
   - `git diff main...HEAD` (or the intended base branch)
2. Ensure the branch exists and is pushed:
   - If needed, create/switch to feature branch.
   - Push with upstream tracking: `git push -u origin HEAD`.
3. Draft PR content using `/pr-title-description`:
   - Title: short, imperative, verb-first.
   - Description sections:
     - `## Summary`
     - `## Important changes`
     - `## Other changes`
     - `## Key files to review`
     - `## How to test`
4. Create PR with heredoc body:

```bash
gh pr create --title "Add concise verb-first title" --body "$(cat <<'EOF'
## Summary

1-3 sentences on what changed and why.

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
)"
```

5. Return the PR URL and a short test note.

## Quality checklist

- PR title starts with a verb and has no trailing period.
- Description follows `/pr-title-description` sections exactly.
- High-risk behavior and reviewer-critical files are explicitly called out.
- Test steps are concrete and include expected outcomes.
