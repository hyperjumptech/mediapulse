# KG-INT-01: Filter Content-Generation to Use Only Selected Articles

## Type

Enhancement

## Priority

High

## Description

Modify the `getDataSourcesForTicker` service in `agent-data-api` so that the content-generation agent receives only articles that the analysis agent has marked as `selected = true` (scored today), instead of all articles for a ticker.

## Acceptance criteria

- [ ] `GET /api/content-generation?tickerId=...` returns only DataSources with `article_relevance.selected = true` and `scoredAt >= start of today (UTC)`
- [ ] Results ordered by relevance score descending
- [ ] When no scored articles exist for today, returns empty array (content-generation agent already handles empty sources gracefully with a "skipped" response)
- [ ] Backward compatible: if `article_relevance` table is empty (e.g. analysis agent hasn't run yet), returns empty array rather than crashing
- [ ] Existing unit tests updated
- [ ] New unit tests for the filtered query
- [ ] JSDoc updated on the modified function
- [ ] `pnpm code-quality` passes

## Current code

```typescript
// apps/agent-data-api/src/services/content-generation.ts
export async function getDataSourcesForTicker(tickerId: string) {
  return prisma.dataSource.findMany({
    where: { tickerId },
  });
}
```

## Target code

```typescript
export async function getDataSourcesForTicker(
  tickerId: string,
  deps: { db?: typeof prisma } = {},
) {
  const { db = prisma } = deps;
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  return db.dataSource.findMany({
    where: {
      tickerId,
      articleRelevances: {
        some: {
          tickerId,
          selected: true,
          scoredAt: { gte: todayStart },
        },
      },
    },
    include: {
      articleRelevances: {
        where: { tickerId, selected: true },
        select: { score: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
```

## Files to modify

- `apps/agent-data-api/src/services/content-generation.ts`
- `apps/agent-data-api/src/services/content-generation.test.ts` (add/update tests)

## Dependencies

- KG-DATA-01, KG-DATA-02 (article_relevance table must exist)

## Notes

- The content-generation agent itself (`apps/agents/content-generation/src/index.ts`) does NOT need changes. It already handles empty sources with a "skipped" response, and it just maps sources to text for the LLM prompt.
- The `orderBy` sorts by `createdAt` desc as a simple proxy. Ideally we'd sort by score, but Prisma doesn't support ordering by a nested relation field directly. The analysis agent already selects the top K, so all returned articles are high-quality.
