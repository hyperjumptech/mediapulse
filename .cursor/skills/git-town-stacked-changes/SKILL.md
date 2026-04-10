---
name: git-town-stacked-changes
description: Implements features as Git Town stacked branches so each layer ships as a small, reviewable PR. Maps PRD ticket batches (from prd-to-tickets) to branch stacks, dependency order, and PR bases. Covers when and how to gate user-visible work with feature flags so early merged layers stay safe until later tickets land, and requires removing those gates (code + env + tests) once the feature is fully on main unless the flag is intentionally permanent. Use when the user asks for stacked PRs, stacked branches, Git Town, smaller PRs, incremental merge order, partial merge order (UI before API), or when following up after /prd-to-tickets output.
---

# Git Town stacked changes (small PRs)

## When to use

- Work should land as **multiple PRs** instead of one large branch.
- The user mentions **Git Town**, **stacked changes**, **stacked PRs**, or **dependent branches**.
- **Follow-up after `/prd-to-tickets`:** tickets exist under `~/.cursor/plans/tickets/` (or an override path) and implementation should mirror **ticket order and dependencies**.

Official reference: [Stacked changes (Git Town)](https://www.git-town.com/stacked-changes.html).

## Prerequisites

- [Git Town](https://www.git-town.com/) installed and configured for this repo (parent branch, remote, per-project settings as needed).
  - **Verify installation:** run `git town --version` (prints the Git Town version). Do **not** run `git town version`—that is not the supported check and can fail or exit non-zero, so agents may incorrectly assume Git Town is not installed.
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
5. **Temporary flags are debt** — flags introduced only to survive partial stack merges must be **removed** (see [Remove the flag when it is no longer needed](#remove-the-flag-when-it-is-no-longer-needed)) after all related tickets are on `main`, unless the PRD calls for a **long-lived** kill switch or gradual rollout.

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
- **Title/body:** Reference the ticket `id`, `group_slug`, and `prd_refs` from the ticket file. For GitHub issues before PRs, follow [create-github-issue](../create-github-issue/SKILL.md); for `gh pr create`, follow the repo’s [open-github-pr](../open-github-pr/SKILL.md) skill (`--body-file`, etc.).
- Optional: [Git Town GitHub Action](https://www.git-town.com/) for a visible stack graph on PRs (if enabled in the project).

## Agent checklist (implementation follow-up)

When moving from tickets to code:

1. Read the ticket batch directory and list **ids** and **Depends on** edges.
2. Topologically order tickets (dependencies first).
3. For each ticket in order: ensure a **dedicated branch**; use `hack` for the first independent slice, `append` for dependent slices.
4. **Assess feature-flag need** (see next section): if an earlier ticket would expose UI, routes, or product behavior that depends on a **later** ticket (API, schema, worker, permissions), gate that behavior behind a flag defaulting **off** until the stack is complete—or reorder tickets so vertical slices merge safely without dead ends.
5. **Plan flag removal**: if you add a **temporary** merge-order flag, record in the **last** integrating ticket (or a dedicated cleanup ticket) that the gate must be **deleted** and env/docs updated—do not leave the feature forever behind `if (env.FLAG)`.
6. Keep commits scoped; run **`pnpm code-quality`** (or project equivalent) before pushing each layer if the repo requires it.
7. Open PRs from **leaf to root** is wrong — **ship/merge from root of stack toward tip** (oldest / closest to `main` first).

## Feature flags when the stack splits UI and backend (or any unsafe partial ship)

Stacked PRs often split work **horizontally**: e.g. `main → ticket1 (types) → ticket2 (UI only) → ticket3 (API + persistence)`. If **ticket2** merges before **ticket3**, users must not see broken navigation, empty states that imply missing backend, or actions that always fail.

### When the agent should introduce a flag

Use a **single, initiative-level gate** (not one flag per tiny commit) when **any** of these hold:

- **User-visible surface** ships in an earlier PR than the **behavior or data** it requires.
- **Server and client** are split across tickets and the UI is not meaningfully useful—or is misleading—without the rest.
- **Risky or irreversible** behavior would run if half the stack is on `main` (writes, billing, notifications) even if “the button exists.”

**Prefer avoiding flags** when you can: merge a **vertical slice** per ticket (minimal API + minimal UI together), or put **ticket2** behind **ticket3** in the stack so backend merges first. Use flags when ordering or slice shape makes horizontal layers unavoidable.

### Naming and ownership

- **One flag per initiative** when multiple tickets belong to the same `group_slug` / product feature: e.g. `HERMES_FEATURE_X_ENABLED` or `NEXT_PUBLIC_HERMES_FEATURE_X` only if the surface must be known on the client (prefer **server-evaluated** flags for sensitive or SSR’d UI so defaults stay server-controlled).
- Reuse the **same** flag and check in **every** stacked PR that touches the feature until the final ticket **enables** it, then **removes** the gate entirely when safe (see below)—unless the initiative needs a **permanent** operational flag.
- Document in **ticket Notes** and **PR bodies**: flag name, default (`false` / off in prod), **which ticket enables the feature for users**, and **which ticket removes** the flag after the stack is complete.

### Default and rollout semantics

- **Default off** in production-shaped configs until the **last** slice that completes the feature is merged (or until AC explicitly allows a phased rollout).
- **Enabling for users** belongs in the PR that makes the feature **correct end-to-end** (often the backend / integration ticket): you may flip default to **on** in that PR **or** remove branching and ship the feature unconditionally in the same change—prefer **removing the flag** once nothing on `main` depends on “off” anymore.
- **Cleanup** belongs in that same final PR or immediately after: do not stop at “flag defaults to true”; **delete** the temporary gate unless the product needs an ongoing switch (see [Remove the flag…](#remove-the-flag-when-it-is-no-longer-needed)).
- If the repo uses typed env (`@hermes/env`, `@mediapulse/env`), add or reuse an env key following [env-variables](../env-variables/SKILL.md); do not read `process.env` ad hoc. When removing the flag, **remove the env key** from schema and `env.example` per that skill and rebuild the env package.

### Implementation discipline

- **Gate the entry point**, not scattered `if` fragments: hide nav items, routes, server actions, or job triggers in one place where possible so reviewers see the flag clearly.
- **Server components and loaders**: evaluate the flag on the server so disabled features do not flash on the client.
- **APIs introduced early**: return **404** or **501** when the flag is off, or omit routes until the implementing ticket registers them—avoid ambiguous empty success responses.
- **Tests**: cover both flag-off (no leakage of UI or side effects) and flag-on behavior while the flag exists. When the flag is **removed**, update or delete tests that only asserted the old branchy behavior; keep coverage for the feature’s real behavior without the gate.

### Remove the flag when it is no longer needed

Treat stack-only flags as **short-lived**. Once **every** ticket in the initiative is merged to `main` and the feature is correct end-to-end, **remove** the gate in a deliberate PR (same as “enable” or immediately after—never leave it as optional tech debt).

**Do in the cleanup PR:**

1. **Delete** conditional checks and wire the feature **unconditionally** (nav, routes, handlers, jobs).
2. **Remove** the env variable (or config key) from the typed env package, `env.example`, and any deployment docs; run the env package **build** so generated types stay correct ([env-variables](../env-variables/SKILL.md)).
3. **Search** the repo for the flag symbol/name and **delete stragglers** (comments, stale TODOs, duplicate helpers).
4. **Adjust tests** so they no longer depend on toggling the removed flag; keep regression coverage for the shipped feature.

**When _not_ to remove:** the PRD or team explicitly wants a **long-term** flag (gradual rollout, entitlement, per-tenant switch, emergency kill switch). Then document that the flag is **permanent** in ticket Notes and skip mandatory removal—but still avoid duplicate or confusing names.

### Agent mini-checklist (per stacked initiative)

1. After ordering tickets, ask: “If PR _k_ merges alone, is anything **broken or misleading**?” If yes → flag or reorder.
2. Introduce the flag in the **first** PR that would otherwise expose incomplete behavior (often the same PR as the UI), unless the repo pattern is “define flag in first PR, consume in later PRs”—either way, keep **one** name stable across the stack.
3. Mention in each PR description: **stack position**, **flag name**, whether this PR **adds**, **wires**, **enables**, or **removes** the gate.
4. **Final integrating PR (or dedicated follow-up):** remove the temporary flag per **Remove the flag when it is no longer needed**—do not leave `FEATURE_X_ENABLED` in the codebase once the stack is done unless it is explicitly a permanent control.

## Optional deep dive

- Full command list and edge cases: [Git Town documentation](https://www.git-town.com/).
- Ticket file format and prefixes: [prd-to-tickets](../prd-to-tickets/SKILL.md).
