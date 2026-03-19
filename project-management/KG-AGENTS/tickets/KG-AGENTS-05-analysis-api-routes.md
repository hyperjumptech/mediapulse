# KG-AGENTS-05: Analysis API Routes in agent-data-api

## Type

Feature

## Priority

High

## Description

Add the `GET /api/analysis` and `POST /api/analysis` routes in `agent-data-api` that the analysis agent uses to read unanalyzed articles and write KG data + relevance scores.

## Acceptance criteria

- [ ] `GET /api/analysis?tickerId=<uuid>&unanalyzed=true` returns unscored DataSources + EntityType/RelationType vocabularies
- [ ] `POST /api/analysis` bulk-writes entities, aliases, ticker-entities, relations, article-entities, and article-relevance scores
- [ ] Routes registered in `apps/agent-data-api/src/index.ts`
- [ ] Zod schemas for request/response validation
- [ ] Service functions with JSDoc and DI
- [ ] Unit tests with 100% coverage for service functions
- [ ] `pnpm code-quality` passes

## GET /api/analysis

**Query params:**

- `tickerId` (required, uuid)
- `unanalyzed` (optional, "true") — when true, return only DataSources that have no `article_relevance` row for this ticker

**Response:**

```json
{
  "dataSources": [
    {
      "id": "ds-001",
      "url": "https://...",
      "title": "DSSA Catat Laba...",
      "content": "PT Dian Swastatika...",
      "tickerId": "...",
      "createdAt": "2026-03-19T..."
    }
  ],
  "entityTypes": [
    {
      "id": "...",
      "name": "COMPANY",
      "description": "A registered business..."
    },
    { "id": "...", "name": "PERSON", "description": "An individual..." }
  ],
  "relationTypes": [
    { "id": "...", "name": "CEO_OF", "description": "Person is CEO of..." },
    { "id": "...", "name": "SUBSIDIARY_OF", "description": "..." }
  ],
  "existingEntities": [
    {
      "id": "ent-001",
      "canonicalName": "Golden Energy Mines",
      "typeId": "...",
      "aliases": ["GEMS"]
    }
  ]
}
```

**Service logic:**

1. Fetch DataSources for this ticker that have no matching `article_relevance` row:
   ```
   prisma.dataSource.findMany({
     where: {
       tickerId,
       articleRelevances: { none: { tickerId } }
     }
   })
   ```
2. Fetch all EntityType and RelationType records
3. Fetch existing entities in this ticker's KG (via `ticker_entity`) with their aliases, so the agent can match against them before creating duplicates

## POST /api/analysis

**Body:**

```json
{
  "tickerId": "uuid",
  "entities": [
    {
      "canonicalName": "Golden Energy Mines",
      "typeId": "uuid",
      "description": "Coal mining subsidiary",
      "aliases": ["GEMS", "PT Golden Energy Mines Tbk"]
    }
  ],
  "relations": [
    {
      "fromEntityName": "Golden Energy Mines",
      "toEntityName": "Dian Swastatika Sentosa",
      "relationTypeId": "uuid"
    }
  ],
  "articleEntities": [
    {
      "dataSourceId": "ds-001",
      "entityName": "Golden Energy Mines",
      "mentionCount": 5,
      "confidence": 0.98,
      "sentiment": "NEUTRAL"
    }
  ],
  "articleRelevances": [
    {
      "dataSourceId": "ds-001",
      "score": 0.93,
      "scoreBreakdown": {
        "aliasMatch": 0.95,
        "entityOverlap": 0.85,
        "freshness": 1.0,
        "sourceQuality": 0.8,
        "novelty": 1.0
      },
      "selected": true
    }
  ]
}
```

**Service logic (in a transaction):**

1. For each entity in `entities`:
   - Normalize aliases (`toLowerCase().trim()`)
   - Check `entity_alias.normalizedAlias` for existing match
   - If match: reuse existing entity ID
   - If no match: create Entity + EntityAlias records
   - Upsert `ticker_entity` for this ticker
2. For each relation in `relations`:
   - Resolve entity IDs from canonical names (using the entities just created/matched)
   - Upsert `entity_relation` (unique on fromEntityId + toEntityId + relationTypeId)
3. For each article-entity in `articleEntities`:
   - Resolve entity ID from name
   - Upsert `article_entity` (unique on dataSourceId + entityId)
4. For each article-relevance in `articleRelevances`:
   - Create `article_relevance` record with tickerId from the request

**Response:**

```json
{
  "entitiesCreated": 5,
  "entitiesReused": 3,
  "relationsCreated": 4,
  "articlesScored": 20,
  "articlesSelected": 10
}
```

## Files to create

- `apps/agent-data-api/src/routes/analysis.ts`
- `apps/agent-data-api/src/services/analysis.ts`
- `apps/agent-data-api/src/services/analysis.test.ts`
- `apps/agent-data-api/src/schemas/analysis.ts`

## Files to modify

- `apps/agent-data-api/src/index.ts` (register routes)

## Dependencies

- KG-DATA-01, KG-DATA-02 (tables must exist)

## Notes

- The POST endpoint does a lot of work in a single transaction. This is intentional: entity resolution, relation creation, and scoring must be consistent. If performance becomes an issue later, we can split into multiple endpoints.
- Entity matching by `normalizedAlias` is the key dedup mechanism. The service must normalize consistently (lowercase, trim whitespace, strip punctuation).
