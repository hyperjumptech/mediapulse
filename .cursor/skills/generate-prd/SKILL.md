---
name: generate-prd
description: Drafts and refines Product Requirements Documents (PRDs) using a 100-point quality rubric. **Solidifies requirements through interactive Q&A first** (AskQuestion or numbered questions)—does not leave a large “open questions” or `[TBD]` graveyard in lieu of asking. **By default, saves the finished PRD to `~/.cursor/plans/`** (same directory as Cursor-generated plans) as a `.prd.md` file, then replies in chat. Use when writing or improving a PRD, product requirements, feature spec, or when the user asks for PRD quality, scoring, or acceptance criteria.
---

# Generate a High-Quality PRD

Use this rubric to **produce** PRDs and to **review** drafts. Total possible score: **100 points**. Aim for **90+** (Excellent) before treating the document as final.

## Scoring rubric (self-check)

| Criterion                         | Max | What “good” looks like                                                                                                                                                               |
| --------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Clarity**                    | 10  | Plain language; jargon defined or avoided; one idea per paragraph; short sentences where possible.                                                                                   |
| **2. Comprehensiveness**          | 15  | Problem, goals, scope, non-goals, users, flows, data, integrations, constraints, risks, rollout, and decisions documented (not deferred to an “open questions” list without asking). |
| **3. Structure and organization** | 10  | Predictable headings; table of contents for long docs; consistent depth; scannable bullets.                                                                                          |
| **4. Prioritization**             | 10  | MoSCoW, P0/P1/P2, or explicit must / should / could / won’t; dependencies called out.                                                                                                |
| **5. Testability**                | 10  | Each requirement has measurable acceptance criteria; given/when/then or checklist-style verification.                                                                                |
| **6. Stakeholder involvement**    | 10  | Named roles or groups consulted; conflicts and trade-offs documented; decisions attributed (who agreed to what).                                                                     |
| **7. User-centric focus**         | 15  | Primary personas or jobs-to-be-done; user stories (“As a … I want … so that …”); pain points and success metrics from the user’s view.                                               |
| **8. Visual aids**                | 5   | Diagrams, flows, or wireframe references where they reduce ambiguity; captions and purpose stated.                                                                                   |
| **9. Flexibility**                | 5   | How scope may change across phases; optional follow-ups are **post-v1**, not unanswered items the agent should have asked about.                                                     |
| **10. Version control**           | 5   | Version, date, author(s), changelog or “what changed since last version.”                                                                                                            |

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

**Before filling the template:** Run the **interactive clarification** steps below so the document is **solid**, not a checklist of unresolved items. Section 10 records what was **decided**, not what was punted.

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

## 10. Confirmed decisions and assumptions

- Bullet each choice the user (or stakeholder) confirmed during drafting: integrations, policies, timelines, scope cuts, success thresholds.
- For any **assumption** the user explicitly approved (e.g. “use industry-default token TTL”), state it here in one line.
- If there are **no** notable decisions beyond the body of the doc, write **N/A** — one line explaining that requirements are fully specified above.

**Do not** use this section as a substitute for asking the user. Unresolved items that block prioritization or acceptance criteria belong in **conversation first**, not here.
```

## Interactive clarification (required for new PRDs)

**Principle:** Prefer **one or two rounds of questions** over a PRD padded with **Open questions**, **`[TBD]`**, or vague placeholders. The user should not have to “fill in” the spec after the agent had a chance to ask.

**Default:** If something material is missing or contradictory, **stop and ask** before delivering a complete PRD. Guessing lowers **Comprehensiveness**, **User-centric focus**, and **Testability**.

### Ask before the first full draft when any of these are unclear

- **Problem and outcome:** What user or business problem is being solved, and what “done” looks like for the business.
- **Primary audience:** Who the main users are (role, context, constraints) — not just “users.”
- **Scope boundary:** What is explicitly **out** of scope or deferred, if the request could be interpreted broadly.
- **Constraints:** Hard deadlines, compliance, platforms, or integrations that would change the design.
- **Success measures:** How the user or team will know the release succeeded (metrics, milestones, or qualitative signals).
- **Technical / delivery specifics** (when they change requirements or acceptance criteria): e.g. auth model, email or notification channel, token/session policy, data residency, feature-flag strategy, supported browsers or clients.

### How to ask

- If the **AskQuestion tool** is available, use it for multiple-choice or pick-one decisions (audience, timeline band, integration choice, policy A vs B). Batch related questions in one form when possible.
- Otherwise send **one short message** with **numbered questions**; each question must be answerable in a line or a pick from options.
- **Order:** Broad first (goal, audience, scope), then specifics that depend on those answers—avoid flooding the user with detailed questions before basics are set.

### When not to block

- **Review-only** tasks (“score this PRD,” “improve wording,” “rewrite section 4”): proceed on the text provided; ask only if the doc is incomplete for the stated task.
- **User explicitly requests a rough / strawman draft:** State that the doc contains **explicit assumptions** and list them in **§10 Confirmed decisions** as “Provisional — user to confirm,” then still offer to convert to Q&A in the next message.

### What not to do

- **Do not** output a long **Open questions** section or many **`[TBD]`** markers when the user could have answered those points in a short Q&A round first.
- **Do not** treat “Open questions” as a normal deliverable for a “final” PRD—**ask**, then integrate answers into requirements with concrete acceptance criteria.

### After answers arrive

- Integrate responses into the PRD body; **remove** `[TBD]` and question lists replaced by decisions.
- If new ambiguity appears mid-draft (e.g. conflicting requirements), **ask again** rather than silently picking one path.

## Default file output (persisted PRDs)

**Unless the user opts out** (“chat only,” “don’t save,” or an explicit path elsewhere), **persist every new or materially updated PRD** to disk so it appears alongside Cursor plan files.

| Item          | Convention                                                                                                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Directory** | `~/.cursor/plans/` — same location Cursor uses for generated `.plan.md` files (on macOS/Linux: `$HOME/.cursor/plans/`). Create the directory if it does not exist.                                                                                                                                                              |
| **Filename**  | `{kebab-case-initiative-slug}.prd.md` derived from the PRD title (e.g. `agent-data-api-versioning.prd.md`). If that path already exists and the new content is not an in-place revision of that file, append a disambiguator: `-2`, `-3`, … or a short date suffix `-{YYYYMMDD}` — pick one scheme consistently in the session. |
| **Contents**  | The full markdown PRD (same as what you deliver in chat), including the template’s title block and sections.                                                                                                                                                                                                                    |
| **Tooling**   | Use the `Write` tool with an **absolute** path (expand `~` to the user’s home directory) so the file is written reliably.                                                                                                                                                                                                       |

**Review-only or incremental edits:** If the user supplied an existing file path, **update that file** when they want it saved. If they did not ask for persistence, **skip** the default save for pure review tasks (see “When not to block”). Otherwise, saving the revised PRD to `~/.cursor/plans/` under the naming rules above is still the default when the outcome is a **full** revised document.

**Chat reply:** After writing the file, **always** state the **absolute path** to the saved `.prd.md` in the first lines of the reply, then give the **rubric summary** and (as today) the PRD body or a pointer to open the file for very long documents.

## Agent workflow

1. **Assess gaps:** Compare the user’s request against “Ask before the first full draft.” List **all** material unknowns that would otherwise become **Open questions** or **`[TBD]`** in the doc.
2. **Ask first (unless review-only or user asked for a strawman):** Use AskQuestion or a numbered message. **Do not** deliver a “complete” PRD in the same turn as the initial request if those gaps are unanswered—unless the user explicitly wants a rough draft with labeled assumptions.
3. **Minimal inference:** Confirm product or initiative name, audience, timeline, greenfield vs iteration; **ask** if inference would be weak—do not bury weak guesses in §10.
4. **Draft** using the template; align language to **Clarity** and **User-centric focus** first. Requirements should read as **decided**, with measurable acceptance criteria.
5. **Add** acceptance criteria under **Testability**; prioritize with **Prioritization**.
6. **Stakeholders:** use named roles when known; if names are unknown, use role titles and list **one** follow-up question to the user rather than a stub in §10.
7. **Visuals:** suggest 1–3 Mermaid diagrams (flow, sequence, or simple architecture) where they reduce ambiguity; reference wireframes as `[placeholder]` only when no asset exists—**ask** if layout is business-critical and unknown.
8. **Score** the draft against the rubric (estimate per row, sum to 100). If the total is below 80, list the **top gaps**; if gaps need user input, **ask in chat** before claiming the doc is final—do not only add §10 bullets.
9. **Persist (default):** Write the complete PRD markdown to `~/.cursor/plans/{slug}.prd.md` per **Default file output** unless the user opted out or the task is review-only without a save request.
10. **Deliver** in chat: lead with the **saved file path**, then the PRD plus a short **rubric summary** (table of scores, total, band, and 3–5 concrete next steps to reach 90+). Next steps should be **implementation or validation**, not “answer the open questions” unless the user chose a strawman.

## Anti-patterns

- Drafting a full PRD while **goals, primary user, or scope** are still vague — ask first.
- **Shipping an “Open questions” appendix** (or many **`[TBD]`**s) **instead of** asking the user in the prior turn — the section was renamed to **Confirmed decisions** precisely to avoid this.
- Requirements without acceptance criteria.
- Features listed without user problem or priority.
- Jargon-heavy prose with no glossary or rewrite.
- “Everyone agreed” without roles or evidence of trade-offs.
- Static dates or version fields left empty when the doc is meant to be maintained.

## Optional: Mermaid

For diagrams, follow the project’s mermaid-diagram skill. Prefer small diagrams that match one decision or flow.
