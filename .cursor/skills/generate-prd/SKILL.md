---
name: generate-prd
description: Drafts and refines Product Requirements Documents (PRDs) using a 100-point quality rubric covering clarity, completeness, prioritization, testability, stakeholders, user focus, visuals, flexibility, and versioning. Asks the user for clarification when goals, scope, audience, or success criteria are ambiguous before producing a full draft. Use when writing or improving a PRD, product requirements, feature spec, or when the user asks for PRD quality, scoring, or acceptance criteria.
---

# Generate a High-Quality PRD

Use this rubric to **produce** PRDs and to **review** drafts. Total possible score: **100 points**. Aim for **90+** (Excellent) before treating the document as final.

## Scoring rubric (self-check)

| Criterion                         | Max | What “good” looks like                                                                                                                      |
| --------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Clarity**                    | 10  | Plain language; jargon defined or avoided; one idea per paragraph; short sentences where possible.                                          |
| **2. Comprehensiveness**          | 15  | Problem, goals, scope, non-goals, users, flows, data, integrations, constraints, risks, rollout, and open questions covered where relevant. |
| **3. Structure and organization** | 10  | Predictable headings; table of contents for long docs; consistent depth; scannable bullets.                                                 |
| **4. Prioritization**             | 10  | MoSCoW, P0/P1/P2, or explicit must / should / could / won’t; dependencies called out.                                                       |
| **5. Testability**                | 10  | Each requirement has measurable acceptance criteria; given/when/then or checklist-style verification.                                       |
| **6. Stakeholder involvement**    | 10  | Named roles or groups consulted; conflicts and trade-offs documented; decisions attributed (who agreed to what).                            |
| **7. User-centric focus**         | 15  | Primary personas or jobs-to-be-done; user stories (“As a … I want … so that …”); pain points and success metrics from the user’s view.      |
| **8. Visual aids**                | 5   | Diagrams, flows, or wireframe references where they reduce ambiguity; captions and purpose stated.                                          |
| **9. Flexibility**                | 5   | Explicit unknowns; how scope may change; criteria for phased delivery.                                                                      |
| **10. Version control**           | 5   | Version, date, author(s), changelog or “what changed since last version.”                                                                   |

### Score bands

| Total    | Band              |
| -------- | ----------------- |
| 90–100   | Excellent         |
| 80–89    | Good              |
| 70–79    | Fair              |
| 60–69    | Needs improvement |
| Below 60 | Poor              |

## PRD template (maps to rubric)

Use this outline unless the user specifies another format. Fill every section that applies; mark **N/A** with one line of explanation.

```markdown
# [Product / initiative name]

**Version:** x.y | **Date:** YYYY-MM-DD | **Owner:** [name/team]

## Changelog

- x.y (YYYY-MM-DD): [summary of changes]

## 1. Summary and context

- Problem statement (why now)
- Business / product goals (outcomes, not features)
- **Non-goals** (explicit scope boundaries)

## 2. Users and stakeholders

- Primary personas or segments (or JTBD)
- **Stakeholders:** [role] — interest / decision authority
- How input was gathered (interviews, tickets, data) — brief

## 3. User stories and experience

- User stories with priority tags (must / should / could)
- Critical user journeys (happy path + notable edge cases)
- Success metrics (user-facing and business), baseline if known

## 4. Requirements

### Must-have (P0)

- [REQ-001] …
  - **Acceptance criteria:** …

### Should-have (P1)

- …

### Could-have (P2)

- …

### Won’t (this release)

- …

## 5. Functional specification

- Detailed behavior, states, errors, empty states
- APIs, events, data contracts — only as needed for clarity

## 6. Non-functional requirements

- Performance, security, privacy, accessibility, reliability, observability
- Constraints (platform, compliance, deadlines)

## 7. Dependencies and risks

- External systems, teams, data
- Risks and mitigations

## 8. Rollout and flexibility

- Phasing, feature flags, migration, rollback
- What may change after v1; how revisions are decided

## 9. Visuals

- [Link or embed] diagrams / wireframes / flowcharts
- One sentence each: what the reader should take away

## 10. Open questions

- Question — owner — target date
```

## When to ask for clarification

**Default:** If something material is missing or contradictory, **stop and ask** before writing a long PRD. Guessing lowers **Comprehensiveness**, **User-centric focus**, and **Testability**.

### Ask before the first full draft when any of these are unclear

- **Problem and outcome:** What user or business problem is being solved, and what “done” looks like for the business.
- **Primary audience:** Who the main users are (role, context, constraints) — not just “users.”
- **Scope boundary:** What is explicitly **out** of scope or deferred, if the request could be interpreted broadly.
- **Constraints:** Hard deadlines, compliance, platforms, or integrations that would change the design.
- **Success measures:** How the user or team will know the release succeeded (metrics, milestones, or qualitative signals).

### Prefer structured questions

- If the **Cursor AskQuestion tool** is available, use it for multiple-choice or pick-one decisions (e.g. audience, timeline band, must-have vs exploration).
- Otherwise ask in **one short message** with **numbered questions**; keep each question specific and answerable.

### When not to block

- **Review-only** tasks (“score this PRD,” “improve wording”): proceed on the text provided; ask only if the doc is incomplete for the stated task.
- **Minor gaps:** If one or two details are missing, you may draft with **`[TBD]`** and list those items under **Open questions** — but still **ask** if the gap blocks prioritization or acceptance criteria (e.g. unknown primary user).

### After answers arrive

- Integrate responses into the PRD; remove stale `[TBD]` where resolved.
- If new ambiguity appears mid-draft (e.g. conflicting requirements), **ask again** rather than silently picking one path.

## Agent workflow

1. **Assess gaps:** Compare the user’s request against “When to ask for clarification.” If critical gaps exist, **ask first** (see above); do not produce a full PRD on assumptions alone.
2. **Minimal inputs:** When not blocked, confirm or infer: product or initiative name, audience, timeline, greenfield vs iteration — ask if inference would be weak.
3. **Draft** using the template; align language to **Clarity** and **User-centric focus** first.
4. **Add** acceptance criteria under **Testability**; prioritize with **Prioritization**.
5. **Stakeholders:** use named roles when known; use placeholders only where non-blocking and list follow-ups under **Open questions**.
6. **Visuals:** suggest 1–3 Mermaid diagrams (flow, sequence, or simple architecture) where they reduce ambiguity; reference wireframes as `[placeholder]` if none exist.
7. **Score** the draft against the rubric (estimate per row, sum to 100). If the total is below 80, list the **top gaps**; if gaps need user input, **ask** before claiming the doc is final.
8. **Deliver** the PRD plus a short **rubric summary**: table of scores, total, band, and 3–5 concrete next steps to reach 90+.

## Anti-patterns

- Drafting a full PRD while **goals, primary user, or scope** are still vague — ask first.
- Requirements without acceptance criteria.
- Features listed without user problem or priority.
- Jargon-heavy prose with no glossary or rewrite.
- “Everyone agreed” without roles or evidence of trade-offs.
- Static dates or version fields left empty when the doc is meant to be maintained.

## Optional: Mermaid

For diagrams, follow the project’s mermaid-diagram skill. Prefer small diagrams that match one decision or flow.
