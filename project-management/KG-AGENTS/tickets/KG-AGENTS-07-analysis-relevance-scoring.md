# KG-AGENTS-07: Analysis Agent — Relevance Scoring and Article Selection

## Type

Feature

## Priority

High

## Description

Implement the relevance scoring and article selection steps of the analysis agent. After entity extraction (KG-AGENTS-06), compute a composite relevance score for each article against the ticker and select the top K articles for the newsletter.

## Acceptance criteria

- [ ] 5-signal composite scoring implemented (see signals below)
- [ ] Weights are configurable (passed as agent config, not hardcoded)
- [ ] Score breakdown stored as JSON for observability
- [ ] Top K articles marked as `selected = true` (K is configurable, default 10)
- [ ] Articles below a minimum threshold are never selected even if they'd be in top K
- [ ] All scored articles + entity data posted to `POST /api/analysis`
- [ ] Unit tests with 100% coverage, including edge cases (zero articles, all low-score, ties)
- [ ] `pnpm code-quality` passes

## Scoring signals

| Signal          | Weight (default) | Computation                                                                                                                                                                                                   |
| --------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aliasMatch`    | 0.30             | Check if ticker symbol, company name, or any known ticker alias appears in article title or content. Score: 1.0 if in title, 0.7 if only in content, 0.0 if absent.                                           |
| `entityOverlap` | 0.30             | Count how many of the article's extracted entities already exist in this ticker's KG (`ticker_entity`). Score = matched / total article entities.                                                             |
| `freshness`     | 0.20             | Decay based on article age: today = 1.0, 1 day old = 0.8, 2 days = 0.6, 3 days = 0.4, 4+ days = 0.2.                                                                                                          |
| `sourceQuality` | 0.10             | Domain-based trust score. Default 0.5 for unknown domains. Known financial news domains (kontan, bisnis, cnbcindonesia, reuters, bloomberg) get 0.8-1.0. Configurable via agent config.                       |
| `novelty`       | 0.10             | Compare article title against already-selected articles using simple Jaccard similarity on word tokens. If > 0.6 similarity to any selected article, novelty = 0.2 (near-duplicate). Otherwise novelty = 1.0. |

**Formula:**

```
score = w.aliasMatch * aliasMatch
      + w.entityOverlap * entityOverlap
      + w.freshness * freshness
      + w.sourceQuality * sourceQuality
      + w.novelty * novelty
```

## Agent config schema

```typescript
const ConfigSchema = z
  .object({
    weights: z
      .object({
        aliasMatch: z.number().default(0.3),
        entityOverlap: z.number().default(0.3),
        freshness: z.number().default(0.2),
        sourceQuality: z.number().default(0.1),
        novelty: z.number().default(0.1),
      })
      .default({}),
    maxSelected: z.number().default(10),
    minScoreThreshold: z.number().default(0.25),
    trustedDomains: z.record(z.number()).default({
      "kontan.co.id": 0.85,
      "bisnis.com": 0.85,
      "cnbcindonesia.com": 0.8,
      "idxchannel.com": 0.8,
      "reuters.com": 0.9,
      "bloomberg.com": 0.9,
      "finance.yahoo.com": 0.75,
    }),
  })
  .default({});
```

## Selection logic

1. Compute score for all articles
2. Sort by score descending
3. Filter out articles below `minScoreThreshold`
4. Take top `maxSelected`
5. Mark those as `selected = true`
6. All articles (selected or not) get an `article_relevance` record for observability

## Files to create

- `apps/agents/analysis/src/score-articles.ts`
- `apps/agents/analysis/src/score-articles.test.ts`
- `apps/agents/analysis/src/signals/alias-match.ts`
- `apps/agents/analysis/src/signals/alias-match.test.ts`
- `apps/agents/analysis/src/signals/entity-overlap.ts`
- `apps/agents/analysis/src/signals/entity-overlap.test.ts`
- `apps/agents/analysis/src/signals/freshness.ts`
- `apps/agents/analysis/src/signals/freshness.test.ts`
- `apps/agents/analysis/src/signals/source-quality.ts`
- `apps/agents/analysis/src/signals/source-quality.test.ts`
- `apps/agents/analysis/src/signals/novelty.ts`
- `apps/agents/analysis/src/signals/novelty.test.ts`

## Files to modify

- `apps/agents/analysis/src/index.ts` (add ConfigSchema)

## Dependencies

- KG-AGENTS-06 (entity extraction produces the input for scoring)
- KG-AGENTS-05 (API routes for reading ticker KG and writing scores)

## Notes

- Each scoring signal is in its own file for testability. The `score-articles.ts` module composes them.
- The novelty signal uses simple word-token Jaccard — not embeddings. This keeps it fast and dependency-free. Can be upgraded later.
- Scoring is deterministic (no LLM involved). This makes tests straightforward with fixed inputs/outputs.
