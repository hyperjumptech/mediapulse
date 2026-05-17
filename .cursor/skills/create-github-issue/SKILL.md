---
name: create-github-issue
description: Structures GitHub issue titles and markdown bodies (Summary, Scope, Acceptance criteria, Notes) and creates issues with gh using --body-file and temp files outside the repo. Sets cross-issue dependencies via GitHub's native blocked-by relationships (GraphQL addBlockedBy), not via a Dependencies markdown section. After creation, rewrites any local prefix IDs in the body to the actual GitHub issue numbers. Use when creating or drafting a GitHub issue, running gh issue create, filing a ticket before a PR, or when the user asks for issue format or templates.
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

| Section                 | Content                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Summary**             | 1–3 sentences: problem, intended change, user/maintainer impact. Use **bold** on key terms when it helps quick scanning. |
| **Scope**               | Bullets: **In scope** and **Out of scope** (use explicit “none” for out-of-scope when everything is in scope).           |
| **Acceptance criteria** | `- [ ]` checklist items that are **testable** (behavior, docs, or scripted verification).                                |
| **Notes**               | PRD section refs, policy conflicts, rollout risks; **omit** the section if there is nothing material.                    |

**Do not include a `## Dependencies` section in the GitHub issue body.** Cross-issue ordering belongs in GitHub's **native issue relationships** (blocked by / blocking). See [Issue relationships](#issue-relationships-blocked-by--blocking) below. If the source markdown (e.g. a `prd-to-tickets` file) carries a `## Dependencies` section, **parse it first, strip it from the body, and use it to drive `addBlockedBy` mutations after the issues exist**.

**Do not duplicate the title.** GitHub already renders the issue title at the top; strip any leading `# Title` H1 and any `**Group:** …` byline from the source markdown before posting. The label and any GitHub project assignment carry the grouping context.

### Copy-paste template

```markdown
## Summary

## Scope

- In scope:
- Out of scope:

## Acceptance criteria

- [ ]

## Notes
```

## Issue relationships (blocked by / blocking)

Set cross-issue ordering with GitHub's **native dependency** relationships. They render as pills in the issue header and surface in `gh` queries, instead of being text-only mentions buried in the body.

### GraphQL mutation

GitHub exposes `addBlockedBy` / `removeBlockedBy` on the `Mutation` type. Both take two **node IDs** (not numbers):

```graphql
mutation ($issue: ID!, $blocking: ID!) {
  addBlockedBy(input: { issueId: $issue, blockingIssueId: $blocking }) {
    issue {
      number
    }
    blockingIssue {
      number
    }
  }
}
```

Read it as: _issue `$issue` is blocked by `$blocking`_. The reciprocal `blocking` pill on the other issue is set automatically.

### Verifying

```bash
gh api graphql -f query='query {
  repository(owner:"<owner>", name:"<repo>") {
    issue(number:<n>) {
      issueDependenciesSummary { blockedBy blocking }
      blockedBy(first:20) { nodes { number title } }
      blocking(first:20)  { nodes { number title } }
    }
  }
}'
```

### Resolving node IDs

`gh issue view <url> --json id,number` returns the node ID alongside the human-readable number. Cache the mapping while creating a batch so the second-pass relationship calls don't reissue lookups.

### Source dependency metadata

When the input is a `prd-to-tickets` file, the dependencies live in the `## Dependencies` section as:

```markdown
- Depends on: PREFIX-001, PREFIX-002
- Blocks: PREFIX-007
```

Parse those lines **before** stripping the section. Build a `blocked_by: {ticket_id -> [ticket_ids]}` map. After every issue in the batch is created, call `addBlockedBy` for each pair using node IDs from the cache. You don't need to set both sides — `blocking` is derived.

## `gh issue create` workflow

1. **Repository and auth** — Use the same **step 1** as [open-github-pr](../open-github-pr/SKILL.md) (resolve `host` / `owner` / `repo`, `gh auth switch`, verify with `gh api`).
2. **Body file** — Never write issue bodies inside the repo clone.
   - `ISSUE_FILE="$(mktemp "${TMPDIR:-/tmp}/gh-issue-body.XXXXXX")"`
   - `trap 'rm -f "$ISSUE_FILE"' EXIT`
   - Write the markdown body to `"$ISSUE_FILE"`, **with the `## Dependencies` section, the H1, and any `**Group:** …` byline removed**.
3. **Create** — `gh issue create --repo "<owner>/<repo>" -t "Imperative concise title" --body-file "$ISSUE_FILE"`
   Add **`-l label`** when team conventions or [prd-to-tickets](../prd-to-tickets/SKILL.md) batch labeling applies (`group_slug`, epic label, etc.).
4. **Capture and verify** — From the printed URL: `gh issue view "<url>" --repo "<owner>/<repo>" --json number,id,state,title`. Confirm **`state` is `OPEN`** and stash `{number, id}` in the batch map (`id` is the node ID needed for relationship mutations). Use `#N` in the PR body per open-github-pr (`Closes` / `Refs` / `Fixes`).
5. **Rewrite cross-refs to `#N`** — Any remaining mentions of local prefix IDs in the body (e.g. `PREFIX-003` cited in Summary, Scope, or Notes) should be replaced with the **GitHub-generated `#<number>`** so they are clickable in GitHub. `gh issue edit <n> --body-file <tmp>` applies the rewrite.
6. **Wire native relationships** — For every `(blocked_id, blocking_id)` pair in the dependency map from the source, call `addBlockedBy` with the cached node IDs.

If `gh issue create` fails (auth, permissions), stop, fix context or have the user create the issue manually—then **`gh issue view`** before opening the PR.

### Batch creation (one-shot script)

When the user asks for several issues from a `prd-to-tickets` run, scripting the flow keeps it atomic:

1. Parse every ticket file once → `(ticket_id, title, body_without_frontmatter_h1_group_dependencies, depends_on_list)`.
2. Create the issues in stack order (parents first) → cache `{ticket_id: (number, node_id)}`.
3. For every issue, rewrite local prefix IDs in the body using the cache → `gh issue edit`.
4. For every `(blocked, blocking)` pair, run the `addBlockedBy` mutation with cached node IDs.
5. Print a final mapping table (`ticket_id` ↔ `#N` ↔ URL) and any verification output from `issueDependenciesSummary`.

Keep the script in `${TMPDIR:-/tmp}` so nothing lands in the repo.

## From PRD ticket markdown ([prd-to-tickets](../prd-to-tickets/SKILL.md))

When promoting a ticket file to GitHub:

- **Title:** the ticket `title` (from frontmatter or the `# …` heading).
- **Body:** everything below the YAML frontmatter, **with these stripped**:
  - The H1 line that repeats the title.
  - The optional `**Group:** …` byline directly under the H1.
  - The `## Dependencies` section (after parsing it for native relationship metadata).
- **Label:** apply the batch label if the PRD run used `group_slug` / labeling rules.
- **Relationships:** wire `Depends on:` ids through `addBlockedBy` after the batch exists; do not write them back into the issue body.
- **Cross-refs:** in Summary / Scope / Notes, replace any local `PREFIX-NNN` mentions with the actual `#<github_number>` once known.

The source ticket markdown keeps its `## Dependencies` section and prefix IDs — those stay useful as offline metadata and for git branch / commit naming. They just don't get reposted into GitHub.

## Quality checklist

- Title is imperative and scoped appropriately.
- Summary, Scope, Acceptance criteria, and (optional) Notes are filled.
- **No `## Dependencies` section** in the issue body.
- **No leading H1 or `**Group:** …` byline** in the issue body.
- Acceptance criteria are observable (merged behavior, docs, or checks).
- Issue was created with **`mktemp`** + **`--body-file`** + **`trap`**; no body file left in the repo.
- Local prefix IDs in the body were rewritten to `#<github_number>` for every issue in the batch.
- Native **blocked-by** relationships were set via `addBlockedBy` for every `(depends_on)` pair; spot-check one issue with `issueDependenciesSummary` to confirm.
- **`gh issue view`** confirms each issue is **OPEN** before linking from a PR.
