# KG-AGENTS-08: Wire Analysis Agent run() — Entity Extraction + Scoring + POST

## Type

Feature

## Priority

High

## Description

Wire together the entity extraction (KG-AGENTS-06) and relevance scoring (KG-AGENTS-07) into the analysis agent's `run()` function. This is the orchestration layer: read articles, extract entities, score, select, and POST results back.

## Acceptance criteria

- [ ] `run()` function orchestrates: GET articles -> extract entities -> score -> select -> POST results
- [ ] Handles cold start (no articles to analyze) gracefully — returns `{ success: true, skipped: true }`
- [ ] Handles partial LLM failures (some articles fail extraction) — scores remaining articles, logs errors
- [ ] All extracted + scored data sent in a single `POST /api/analysis` call
- [ ] Integration-style tests that mock the API and LLM, testing the full flow
- [ ] `pnpm code-quality` passes

## Flow

```
1. GET /api/analysis?tickerId=...&unanalyzed=true
   → dataSources[], entityTypes[], relationTypes[], existingEntities[]

2. If dataSources is empty → return { success: true, skipped: true }

3. Extract entities from articles (KG-AGENTS-06)
   → entities[], relations[] per article

4. Score articles (KG-AGENTS-07)
   → articleRelevances[] with scores and selected flags

5. POST /api/analysis
   → { tickerId, entities, relations, articleEntities, articleRelevances }

6. Return { success: true }
```

## Files to modify

- `apps/agents/analysis/src/run.ts` (main orchestration)
- `apps/agents/analysis/src/run.test.ts` (integration-style tests)
- `apps/agents/analysis/src/index.ts` (wire run + ConfigSchema into agent app)

## Dependencies

- KG-AGENTS-06 (entity extraction)
- KG-AGENTS-07 (relevance scoring)
