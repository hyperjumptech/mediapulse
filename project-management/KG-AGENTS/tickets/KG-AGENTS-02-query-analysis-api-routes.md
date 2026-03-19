# KG-AGENTS-02: Query-Analysis API Routes in agent-data-api

## Type

Feature

## Priority

High

## Description

Add the `GET /api/query-analysis` and `POST /api/query-analysis` routes in `agent-data-api` that the query-analysis agent uses to read KG context and write SearchQuery records.

## Acceptance criteria

- [ ] `GET /api/query-analysis?tickerId=<uuid>` returns ticker info, top KG entities, and recent article themes
- [ ] `POST /api/query-analysis` upserts SearchQuery records for a ticker (creates new, soft-replaces stale)
- [ ] Routes registered in `apps/agent-data-api/src/index.ts`
- [ ] Zod schemas for request/response validation
- [ ] Service functions with JSDoc and DI (accept `db` parameter with default `prisma`)
- [ ] Unit tests with 100% coverage for service functions
- [ ] `pnpm code-quality` passes

## GET /api/query-analysis

**Query params:**

- `tickerId` (required, uuid)

**Response:**

```json
{
  "ticker": {
    "id": "...",
    "symbol": "DSSA",
    "name": "Dian Swastatika Sentosa Tbk",
    "metadata": { "Sektor": "Energi", "Industri": "Batu Bara", ... }
  },
  "topEntities": [
    { "canonicalName": "Golden Energy Mines", "typeName": "COMPANY", "relevanceWeight": 0.95 },
    { "canonicalName": "Fuganto Widjaja", "typeName": "PERSON", "relevanceWeight": 0.80 }
  ],
  "recentThemes": [
    { "theme": "Domestic Market Obligation", "articleCount": 4 }
  ]
}
```

**Service logic:**

1. Fetch ticker by ID (include metadata)
2. Fetch top 20 `TickerEntity` records ordered by `relevanceWeight` desc, join `Entity` and `EntityType`
3. Fetch recent article themes: group `ArticleEntity` by `entityId` where `entity.type.name = 'TOPIC'` and `article.createdAt >= 7 days ago`, count occurrences, return top 10

**Cold start:** When no TickerEntity or ArticleEntity records exist, `topEntities` and `recentThemes` return empty arrays. The agent handles this gracefully.

## POST /api/query-analysis

**Body:**

```json
{
  "tickerId": "uuid",
  "queries": [
    { "text": "DSSA Dian Swastatika Sentosa 2026" },
    { "text": "Golden Energy Mines GEMS coal export" }
  ]
}
```

**Service logic:**

1. Delete existing SearchQuery records for this ticker that are older than 24 hours (stale cleanup)
2. Create new SearchQuery records: `prisma.searchQuery.createMany({ data: queries.map(q => ({ text: q.text, tickerId })) })`
3. Return count of created records

**Response:**

```json
{ "created": 8 }
```

## Files to create

- `apps/agent-data-api/src/routes/query-analysis.ts`
- `apps/agent-data-api/src/services/query-analysis.ts`
- `apps/agent-data-api/src/services/query-analysis.test.ts`
- `apps/agent-data-api/src/schemas/query-analysis.ts`

## Files to modify

- `apps/agent-data-api/src/index.ts` (register routes)

## Dependencies

- KG-DATA-01, KG-DATA-02 (tables must exist)
