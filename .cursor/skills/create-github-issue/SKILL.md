---
name: create-github-issue
description: Structures GitHub issue titles and markdown bodies (Summary, Scope, Acceptance criteria, Dependencies, Notes) and creates issues with gh using --body-file and temp files outside the repo. Use when creating or drafting a GitHub issue, running gh issue create, filing a ticket before a PR, or when the user asks for issue format or templates.
---

# Create GitHub issue

## When to use

- User asks to **create**, **file**, or **draft** a GitHub issue.
- User runs or asks for **`gh issue create`**.
- Work is tracked in GitHub and an issue must exist **before** a PR ([open-github-pr](../open-github-pr/SKILL.md) hard gate).

## Issue title

- Short, **imperative**, verb-first (same spirit as PR titles).
- For PR-scoped work, align with the **upcoming PR title** intent.
- For initiatives or epics, a slightly broader title is fine if scope is clarified in **Scope**.

## Issue body structure

Use these **H2** sections in order. Ground content in facts (diff, commits, PRD, design doc)—not placeholders.

| Section | Content |
| ------- | ------- |
| **Summary** | 1–3 sentences: problem, intended change, user/maintainer impact. Use **bold** on key terms when it helps quick scanning. |
| **Scope** | Bullets: **In scope** and **Out of scope** (use explicit “none” for out-of-scope when everything is in scope). |
| **Acceptance criteria** | `- [ ]` checklist items that are **testable** (behavior, docs, or scripted verification). |
| **Dependencies** | `- Depends on:` and `- Blocks:` with ticket ids (e.g. `PREFIX-001`), requirement ids (`REQ-…`), other issue numbers, or `none`. |
| **Notes** | PRD section refs, policy conflicts, rollout risks; **omit** the section if there is nothing material. |

### Copy-paste template

```markdown
## Summary



## Scope

- In scope:
- Out of scope:

## Acceptance criteria

- [ ]

## Dependencies

- Depends on:
- Blocks:

## Notes


```

## `gh issue create` workflow

1. **Repository and auth** — Use the same **step 1** as [open-github-pr](../open-github-pr/SKILL.md) (resolve `host` / `owner` / `repo`, `gh auth switch`, verify with `gh api`).
2. **Body file** — Never write issue bodies inside the repo clone.
   - `ISSUE_FILE="$(mktemp "${TMPDIR:-/tmp}/gh-issue-body.XXXXXX")"`
   - `trap 'rm -f "$ISSUE_FILE"' EXIT`
   - Write the markdown body to `"$ISSUE_FILE"`.
3. **Create** — `gh issue create --repo "<owner>/<repo>" -t "Imperative concise title" --body-file "$ISSUE_FILE"`  
   Add **`-l label`** when team conventions or [prd-to-tickets](../prd-to-tickets/SKILL.md) batch labeling applies (`group_slug`, epic label, etc.).
4. **Capture and verify** — From the printed URL: `gh issue view "<url>" --repo "<owner>/<repo>" --json number,state,title -q .number` (or equivalent). Confirm **`state` is `OPEN`**. Use `#N` in the PR body per open-github-pr (`Closes` / `Refs` / `Fixes`).

If `gh issue create` fails (auth, permissions), stop, fix context or have the user create the issue manually—then **`gh issue view`** before opening the PR.

## From PRD ticket markdown ([prd-to-tickets](../prd-to-tickets/SKILL.md))

When promoting a ticket file to GitHub:

- **Title:** the ticket `title` (from frontmatter or the `# …` heading).
- **Body:** everything **below the YAML frontmatter**—sections already match this skill.
- Apply the batch **label** if the PRD run used `group_slug` / labeling rules.

## Quality checklist

- Title is imperative and scoped appropriately.
- Summary, Scope, Acceptance criteria, and Dependencies are filled; Notes present or omitted on purpose.
- Acceptance criteria are observable (merged behavior, docs, or checks).
- Issue was created with **`mktemp`** + **`--body-file`** + **`trap`**; no body file left in the repo.
- **`gh issue view`** confirms the issue is **OPEN** before linking from a PR.
