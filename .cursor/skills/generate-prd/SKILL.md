---
name: generate-prd
description: Drafts and refines Product Requirements Documents (PRDs) using a 100-point quality rubric covering clarity, completeness, prioritization, testability, stakeholders, user focus, visuals, flexibility, and versioning. Use when writing or improving a PRD, product requirements, feature spec, or when the user asks for PRD quality, scoring, or acceptance criteria.
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

## Agent workflow

1. **Clarify** minimal inputs if missing: product name, audience, deadline, and whether this is greenfield or iteration.
2. **Draft** using the template; align language to **Clarity** and **User-centric focus** first.
3. **Add** acceptance criteria under **Testability**; prioritize with **Prioritization**.
4. **Stakeholder** section: if unknown, use placeholders (`[TBD with PM]`) and list questions to resolve.
5. **Visuals**: suggest 1–3 Mermaid diagrams (flow, sequence, or simple architecture) where they reduce ambiguity; reference wireframes as `[placeholder]` if none exist.
6. **Score** the draft against the rubric (estimate per row, sum to 100). If the total is below 80, list the **top gaps** and revise.
7. **Deliver** the PRD plus a short **rubric summary**: table of scores, total, band, and 3–5 concrete next steps to reach 90+.

## Anti-patterns

- Requirements without acceptance criteria.
- Features listed without user problem or priority.
- Jargon-heavy prose with no glossary or rewrite.
- “Everyone agreed” without roles or evidence of trade-offs.
- Static dates or version fields left empty when the doc is meant to be maintained.

## Optional: Mermaid

For diagrams, follow the project’s mermaid-diagram skill. Prefer small diagrams that match one decision or flow.
