---
name: git-town-stacked-changes
description: Implements features as Git Town stacked branches so each layer ships as a small, reviewable PR. Maps PRD ticket batches (from prd-to-tickets) to branch stacks, dependency order, and PR bases. Use when the user asks for stacked PRs, stacked branches, Git Town, smaller PRs, incremental merge order, or when following up after /prd-to-tickets output.
---

# Git Town stacked changes (small PRs)

## When to use

- Work should land as **multiple PRs** instead of one large branch.
- The user mentions **Git Town**, **stacked changes**, **stacked PRs**, or **dependent branches**.
- **Follow-up after `/prd-to-tickets`:** tickets exist under `~/.cursor/plans/tickets/` (or an override path) and implementation should mirror **ticket order and dependencies**.

Official reference: [Stacked changes (Git Town)](https://www.git-town.com/stacked-changes.html).

## Prerequisites

- [Git Town](https://www.git-town.com/) installed and configured for this repo (parent branch, remote, per-project settings as needed).
- User (or CI) can merge **oldest PR first** when branches depend on each other.

## How this pairs with `/prd-to-tickets`

Ticket files use shared metadata (`ticket_prefix`, `group_slug`, `group_label`) and stable ids (`{ticket_prefix}-{NNN}`). Use that for **branch names and PR titles** so work stays traceable.

| Ticket concept                          | Stacked workflow                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id` (e.g. `DOMAIN-API-RATE-LIMIT-001`) | Base name for the **branch** (plus optional short slug): e.g. `DOMAIN-API-RATE-LIMIT-001-rate-limiter`            |
| **Depends on:** `…-001`                 | Child branch is created **on top of** the branch for `…-001` (not directly on `main` until the parent is merged). |
| Execution order in the batch            | **Ship / merge oldest dependency first** (bottom of the stack toward `main`).                                     |

If two tickets are **independent**, do **not** stack them: use separate top-level branches from `main` ([avoid unnecessary stacking](https://www.git-town.com/stacked-changes.html)).

## Core rules

1. **One focused change per branch** — single responsibility per branch; resist mixing unrelated edits.
2. **Stack only real dependencies** — child branch contains work that truly requires the parent’s commits.
3. **Merge / ship oldest first** — the branch whose base is `main` (or the stack’s root) ships before branches that sit on top of it.
4. **Sync often** — run `git town sync --stack` or `git town sync --all` regularly to reduce drift and [phantom conflicts](https://www.git-town.com/stacked-changes.html) (especially with squash-merge workflows).

## Typical Git Town commands

Adjust names to match ticket ids and slugs.

**Start the stack (first ticket, no ticket dependency):**

```bash
git town hack DOMAIN-API-RATE-LIMIT-001-rate-limiter
# implement + commit on this branch
```

**Add a branch for the next ticket that depends on the previous branch:**

```bash
# while on parent branch
git town append DOMAIN-API-RATE-LIMIT-002-wire-middleware
```

**Insert work between existing layers (new ticket slipped in):**

```bash
git town prepend DOMAIN-API-RATE-LIMIT-001b-shared-types
```

**See where you are in the stack:**

```bash
git town branch
```

**Navigate:**

```bash
git town down   # parent
git town up     # child
```

**Propagate a commit to the right layer** (when Git Town is set up for it — see Git Town docs for your version):

```bash
# Example from Git Town docs: commit staged work into a branch N levels down the stack
git commit --down=2
```

**Keep the stack current with remote and parents:**

```bash
git town sync --stack
# or
git town sync --all
```

**After the bottom PR merges:** sync so local branches rebase onto updated `main` as Git Town expects.

## PRs and review

- **Base branch:** Git Town usually sets the PR base to the **parent branch** so reviewers see a **small diff** (not the whole stack in one PR). After the parent merges, **update or retarget** the next PR to `main` per your hosting provider (or via Git Town ship/sync workflow).
- **Title/body:** Reference the ticket `id`, `group_slug`, and `prd_refs` from the ticket file. For `gh pr create`, follow the repo’s [open-github-pr](../open-github-pr/SKILL.md) skill (`--body-file`, etc.).
- Optional: [Git Town GitHub Action](https://www.git-town.com/) for a visible stack graph on PRs (if enabled in the project).

## Agent checklist (implementation follow-up)

When moving from tickets to code:

1. Read the ticket batch directory and list **ids** and **Depends on** edges.
2. Topologically order tickets (dependencies first).
3. For each ticket in order: ensure a **dedicated branch**; use `hack` for the first independent slice, `append` for dependent slices.
4. Keep commits scoped; run **`pnpm code-quality`** (or project equivalent) before pushing each layer if the repo requires it.
5. Open PRs from **leaf to root** is wrong — **ship/merge from root of stack toward tip** (oldest / closest to `main` first).

## Optional deep dive

- Full command list and edge cases: [Git Town documentation](https://www.git-town.com/).
- Ticket file format and prefixes: [prd-to-tickets](../prd-to-tickets/SKILL.md).
