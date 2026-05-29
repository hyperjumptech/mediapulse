---
name: pr-ac-check-and-issue-checklist
description: Verifies a pull request against an issue's acceptance criteria, then updates the issue checklist by checking only criteria proven met. Use when the user asks to compare a PR vs issue ACs, validate ticket completion, or check off met acceptance criteria on GitHub.
disable-model-invocation: true
---

# PR AC Check And Issue Checklist

Verify a PR against issue acceptance criteria using evidence from code/diff, then check off only criteria that are truly met.

## When to use

- User asks to verify a PR against an issue's acceptance criteria.
- User asks to check or update acceptance checklist items in a GitHub issue.
- User asks for pass/fail (met/partial/not met) AC review tied to a PR.

## GitHub account safety (required before any `gh`)

1. Ask which GitHub login to use.
2. Run `gh api user -q .login`.
3. If the active login does not match, stop and ask the user to switch accounts.
4. Do not edit issues until login is confirmed.

## Workflow

1. Identify targets:
   - PR number/URL (example: `#615`)
   - Issue number/URL (example: `#614`)

2. Load canonical source data:
   - `gh issue view <issue> --json title,body,url`
   - `gh pr view <pr> --json number,title,body,headRefOid,baseRefName,headRefName,url`

3. Evaluate each acceptance criterion with PR evidence:
   - Read the issue checklist items under `## Acceptance criteria`.
   - Verify against changed code (`gh pr diff <pr>`) and/or commit content.
   - Mark each AC as one of: `Met`, `Partial`, `Not met`.
   - If evidence is unclear, default to `Partial` or `Not met` (do not over-check).

4. Update issue checklist:
   - Convert only `Met` checklist lines from `- [ ]` to `- [x]`.
   - Keep `Partial` and `Not met` as `- [ ]`.
   - Preserve all non-checklist issue content unchanged.

5. Edit issue body via temp file:
   - Use `mktemp` outside the repo.
   - Write updated issue body to that temp file.
   - Run `gh issue edit <issue> --body-file "<temp-file>"`.
   - Remove temp file afterward.

6. Verify result:
   - `gh issue view <issue> --json body,url -q .body`
   - Confirm only intended checklist lines changed.

7. Report back:
   - Provide short AC summary (`Met` / `Partial` / `Not met`).
   - Include the issue URL.
   - Call out any unchecked criteria and why they remain unchecked.

## Guardrails

- Never check a criterion without direct evidence from PR code/diff/tests.
- Do not rewrite issue scope/notes unless user asks.
- Do not mark CI/format criteria as met if checks are missing or unverified.
- Prefer deterministic edits (line-level replacement of checklist items only).

## Minimal command pattern

```bash
gh api user -q .login
gh issue view <issue> --json body
gh pr view <pr> --json headRefOid,baseRefName,headRefName,url
gh pr diff <pr>
# prepare updated body in a temp file
gh issue edit <issue> --body-file "<temp-file>"
gh issue view <issue> --json body,url
```
