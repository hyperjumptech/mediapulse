---
name: prd-to-tickets
description: Breaks a Product Requirements Document (PRD) into actionable implementation tickets (issues) as markdown files with titles, priority, scope, acceptance criteria, and traceability to PRD requirement IDs. **By default writes files under `~/.cursor/plans/tickets/`** (override when the user gives another directory). Uses a **representative ticket prefix** (not generic `TICKET-`) and a **shared group slug/label** so related tickets stay filterable. When work will ship as stacked PRs with horizontal splits (UI before API), tickets should document feature-flag gating and enabling order. Use when turning a PRD into work items, GitHub issues, Linear-style tasks, sprint tickets, or when the user asks for tickets from a PRD or feature spec.
---

# PRD → Tickets

## When to use

- User provides or points to a PRD (`.prd.md`, `*.md` spec, or pasted content) and wants **discrete tickets**.
- User asks for issues, tasks, or a **work breakdown** aligned to requirements.

## Output location

1. **Default directory:** `~/.cursor/plans/tickets/`
2. **Override:** If the user names a different folder (absolute or `~/…`), use that instead.
3. **Create the directory** if it does not exist before writing files.

## Inputs

- **PRD source:** Path in the repo, path under home (e.g. `~/.cursor/plans/foo.prd.md`), or inline markdown in chat.
- If scope is unclear (whole PRD vs one section), ask once; default to **all P0/P1** items plus **must-have** requirements if the PRD uses priority tags.

## Ticket prefix and IDs (required)

Use a **short, meaningful prefix** derived from the initiative so IDs are recognizable in branches, commits, and trackers—**do not** use generic `TICKET-001`.

1. **Derive `ticket_prefix`** from the PRD title or product area (ask once if ambiguous):
   - **Pattern:** `SCREAMING-KEBAB-CASE`, **2–5 segments**, **3–28 characters** total (excluding sequence).
   - **Good:** `HERMES-ADM-PWRESET`, `DOMAIN-API-RATE-LIMIT`, `MP-DELIVERY-WEBHOOK`
   - **Avoid:** `TICKET`, `TASK`, `FEAT`, single-word prefixes unless the PRD name is already one clear token.

2. **Sequence:** Zero-padded three digits per batch: `{ticket_prefix}-001`, `{ticket_prefix}-002`, … (global sequence within that PRD run).

3. **Stable `id` field:** The `id` in frontmatter **must** match `{ticket_prefix}-{NNN}`.

4. **Filenames:** `{ticket_prefix}-{NNN}-{short-slug}.md` (e.g. `HERMES-ADM-PWRESET-001-db-schema.md`). Slug: lowercase, hyphens, max ~50 chars, from the ticket title.

## Linking tickets together (group / label)

Every ticket in the **same PRD batch** shares metadata so tools can filter or tag them as one initiative:

| Field           | Required    | Purpose                                                                                                                                                                                            |
| --------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ticket_prefix` | Yes         | Prefix for `id` and filenames (see above).                                                                                                                                                         |
| `group_slug`    | Yes         | **Stable machine id** for the initiative: `kebab-case`, no spaces (e.g. `hermes-admin-password-reset`). Use for GitHub **label** names, Linear project keys, Jira epic links, branch naming hints. |
| `group_label`   | Recommended | **Human-readable** title for the same group (e.g. `Hermes admin password reset`). Shown in tables and when creating issues.                                                                        |

**When exporting to GitHub (or similar):** create or apply a **label** equal to `group_slug`, or use `group_slug` as a namespace prefix (e.g. label `epic:hermes-admin-password-reset`)—**stay consistent within the batch** and document the choice in the chat reply. When creating the GitHub issue from a ticket, use the body structure and `gh` patterns in [create-github-issue](../create-github-issue/SKILL.md).

**Optional sub-batch:** If the PRD defines phases, add `phase: 1` (or `discovery` / `build`) in frontmatter so ordering is clear without splitting `group_slug`.

## Process

1. **Read the PRD** and note sections: goals, non-goals, personas, **must/should/could**, **REQ-\*** or numbered requirements, acceptance criteria, dependencies, risks.
2. **Set `ticket_prefix`, `group_slug`, and `group_label` once** for the whole batch (after deriving from the PRD title unless the user supplied them).
3. **One ticket per implementable slice** — prefer vertical slices (end-to-end user value) when the PRD allows; otherwise one ticket per **REQ** or per **user story** with clear AC.
4. **Do not** merge unrelated requirements into one ticket; **do** merge duplicate or overlapping bullets from the PRD into a single ticket with a clear combined AC.
5. **Traceability:** Each ticket must reference the PRD (`prd_source:` with file path or `"inline PRD"`) and **requirement IDs** when present (`prd_refs: [REQ-001, …]`).
6. **Dependencies:** If the PRD orders work, add a **Depends on:** section using **same-batch ids** (`HERMES-ADM-PWRESET-001`) or REQ ids where tickets are not yet numbered.
7. **Stacked / horizontal splits:** If the user plans **Git Town stacked PRs** and separates layers (e.g. UI ticket before API ticket), add the optional **Stacked delivery** section to affected tickets and specify **feature-flag** expectations so merged-but-incomplete work does not surface to users ([git-town-stacked-changes](../git-town-stacked-changes/SKILL.md)).
8. **Non-goals:** Do not create tickets for items explicitly out of scope unless the user asks to “include deferred items” as a separate backlog file.

## File naming

- **`{ticket_prefix}-{NNN}-{short-slug}.md`** (e.g. `HERMES-ADM-PWRESET-002-session-credential-version.md`).
- Slug: lowercase, hyphens, max ~50 chars, derived from the ticket title.

## Ticket file template

Use this structure for **every** file in a batch (repeat `ticket_prefix`, `group_slug`, `group_label` on each file):

```markdown
---
id: HERMES-ADM-PWRESET-001
ticket_prefix: HERMES-ADM-PWRESET
group_slug: hermes-admin-password-reset
group_label: Hermes admin password reset
title: [Imperative, concise title]
priority: P0 | P1 | P2
prd_source: [path or "inline"]
prd_refs: [REQ-001, REQ-002]
status: draft
---

# [Same as title]

**Group:** Hermes admin password reset (`hermes-admin-password-reset`)

## Summary

[1–3 sentences: what shipped and why it matters to the user.]

## Scope

- In scope: …
- Out of scope: … (or "None beyond PRD non-goals.")

## Acceptance criteria

- [ ] …
- [ ] …

## Dependencies

- Depends on: [none | HERMES-ADM-PWRESET-xxx | REQ-xxx]
- Blocks: …

## Stacked delivery (optional)

Use when tickets will ship as **Git Town stacked PRs** and work is split so an **earlier** ticket is incomplete without a **later** one (e.g. UI in `…-002`, API in `…-003`):

- In **Acceptance criteria**, state that user-visible behavior stays **hidden or non-functional until enabled** (feature flag or equivalent), and name the **enabling** ticket (e.g. “Feature hidden behind `FEATURE_X_ENABLED` until `…-003` merges.”).
- Add AC that the **temporary** flag (and env key, if any) is **removed** after the initiative is fully merged—either in the **last** ticket of the stack or a small follow-up ticket—unless the PRD requires a **permanent** flag.
- In **Notes**, record the **flag/env key** (if known) or “TBD—see …-003,” and call out **merge order** risks for reviewers.

See [git-town-stacked-changes](../git-town-stacked-changes/SKILL.md) for implementation guidance.

## Notes

[APIs, flags, analytics, migration, rollout — only if PRD calls for it.]
```

Adjust the example `HERMES-ADM-PWRESET-*` values to match the actual `ticket_prefix` / `group_slug` / `group_label` for the run. The one-line **Group** line under the H1 is optional but helps plain-markdown readers.

## Quality checks before finishing

- Every **P0 / must-have** requirement maps to at least one ticket **or** is explicitly listed under a parent ticket’s AC with PRD ref.
- No ticket without **testable** acceptance criteria (mirror the PRD’s given/when/then or checklist).
- **`ticket_prefix`, `group_slug`, and `group_label` are consistent** across all files in the batch.
- If **Stacked delivery** and a **merge-order-only** flag are documented, at least one ticket’s AC covers **flag removal** (or states the flag is intentionally permanent).
- Filenames sort in execution order when the PRD implies an order; otherwise sort by **priority** then **id**.

## After writing

- Reply with a **short table**: `id`, `title`, `priority`, `prd_refs`, and repeat **`group_slug`** once for copy-paste into trackers.
- Give the **absolute output directory** used (default or override).

## Optional variants (only if asked)

- **Single file:** `tickets.md` in the same directory containing all tickets as `## {ticket_prefix}-{NNN}` sections; include one YAML or table row with `ticket_prefix`, `group_slug`, `group_label` at the top.
- **Epic grouping:** subfolders `{group_slug}/` when the PRD defines epics or phases **and** the user wants physical separation; keep `group_slug` the same across subfolders unless the user explicitly splits initiatives.
