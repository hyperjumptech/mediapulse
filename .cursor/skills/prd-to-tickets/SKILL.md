---
name: prd-to-tickets
description: Breaks a Product Requirements Document (PRD) into actionable implementation tickets (issues) as markdown files with titles, priority, scope, acceptance criteria, and traceability to PRD requirement IDs. **By default writes files under `~/.cursor/plans/tickets/`** (override when the user gives another directory). Use when turning a PRD into work items, GitHub issues, Linear-style tasks, sprint tickets, or when the user asks for tickets from a PRD or feature spec.
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

## Process

1. **Read the PRD** and note sections: goals, non-goals, personas, **must/should/could**, **REQ-\*** or numbered requirements, acceptance criteria, dependencies, risks.
2. **One ticket per implementable slice** — prefer vertical slices (end-to-end user value) when the PRD allows; otherwise one ticket per **REQ** or per **user story** with clear AC.
3. **Do not** merge unrelated requirements into one ticket; **do** merge duplicate or overlapping bullets from the PRD into a single ticket with a clear combined AC.
4. **Traceability:** Each ticket must reference the PRD (`Source:` line with file path or “inline PRD”) and **requirement IDs** when present (`REQ-001`, etc.).
5. **Dependencies:** If the PRD orders work, add a **Depends on:** section (ticket ids or REQ ids).
6. **Non-goals:** Do not create tickets for items explicitly out of scope unless the user asks to “include deferred items” as a separate backlog file.

## File naming

- **`TICKET-001-short-slug.md`**, **`TICKET-002-…`**, … (zero-padded, global sequence per run).
- Slug: lowercase, hyphens, max ~50 chars, derived from the ticket title.

## Ticket file template

Use this structure for **every** file:

```markdown
---
id: TICKET-001
title: [Imperative, concise title]
priority: P0 | P1 | P2
prd_source: [path or "inline"]
prd_refs: [REQ-001, REQ-002]
status: draft
---

# [Same as title]

## Summary

[1–3 sentences: what shipped and why it matters to the user.]

## Scope

- In scope: …
- Out of scope: … (or "None beyond PRD non-goals.")

## Acceptance criteria

- [ ] …
- [ ] …

## Dependencies

- Depends on: [none | TICKET-xxx | REQ-xxx]
- Blocks: …

## Notes

[APIs, flags, analytics, migration, rollout — only if PRD calls for it.]
```

## Quality checks before finishing

- Every **P0 / must-have** requirement maps to at least one ticket **or** is explicitly listed under a parent ticket’s AC with PRD ref.
- No ticket without **testable** acceptance criteria (mirror the PRD’s given/when/then or checklist).
- Filenames sort in execution order when the PRD implies an order; otherwise sort by **priority** then **id**.

## After writing

- Reply with a **short table**: `id`, `title`, `priority`, `prd_refs`.
- Give the **absolute output directory** used (default or override).

## Optional variants (only if asked)

- **Single file:** `tickets.md` in the same directory containing all tickets as `## TICKET-xxx` sections.
- **Epic grouping:** subfolders `epic-name/TICKET-xxx-….md` when the PRD defines epics or phases.
