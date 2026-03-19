# KG-INT-03: End-to-End Manual Test Plan

## Type

QA / Testing

## Priority

Medium

## Description

A manual test plan to verify the full pipeline works end-to-end for a single ticker (DSSA). This should be executed after all agents and API routes are implemented.

## Prerequisites

- [ ] Local Postgres running with migrations applied
- [ ] Default entity types and relation types seeded (KG-DATA-03)
- [ ] All agents running locally (query-analysis, data-collection, analysis, content-generation, delivery)
- [ ] agent-data-api running locally
- [ ] At least one user + UserTicker record for DSSA exists and is enabled
- [ ] API keys configured (Serper, Jina, OpenAI, Resend)

## Test steps

### Step 1: Query Analysis

1. Trigger query-analysis agent manually for DSSA ticker (POST to agent endpoint or run pipeline from Hermes)
2. Verify: `search_query` table has 8 new rows for DSSA's ticker ID
3. Verify: queries are relevant (mention DSSA, Dian Swastatika, coal, energy, etc.)
4. Verify: queries include both Indonesian and English strings

### Step 2: Data Collection

1. Trigger data-collection agent manually for DSSA ticker
2. Verify: `data_source` table has new rows for DSSA
3. Verify: each data source has a URL, title, and content
4. Verify: data sources reference the search queries from step 1

### Step 3: Analysis

1. Trigger analysis agent manually for DSSA ticker
2. Verify `entity` table: new entities created (companies, people, topics related to DSSA)
3. Verify `entity_alias` table: aliases populated (e.g. "GEMS" for "Golden Energy Mines")
4. Verify `ticker_entity` table: entities linked to DSSA ticker with relevance weights
5. Verify `entity_relation` table: relationships created (e.g. GEMS SUBSIDIARY_OF DSSA)
6. Verify `article_entity` table: articles linked to entities with mention counts
7. Verify `article_relevance` table: all articles scored, top 10 (or fewer) marked as selected
8. Verify: score breakdowns are populated JSON with all 5 signals

### Step 4: Content Generation

1. Trigger content-generation agent manually for DSSA ticker
2. Verify: `newsletter` table has a new row for DSSA
3. Verify: newsletter content references only the selected articles (not all collected articles)
4. Verify: newsletter has subject, description, and formatted content

### Step 5: Delivery (optional, requires Resend)

1. Trigger delivery agent manually for DSSA ticker
2. Verify: email received by the subscribed user
3. Verify: email content matches the newsletter

### Step 6: Day 2 Simulation

1. Run query-analysis again for DSSA
2. Verify: new queries are more specific than day 1 (reference entities from the KG)
3. Compare day 1 queries vs day 2 queries — day 2 should mention specific entities/people/topics

## SQL verification queries

```sql
-- Check search queries generated
SELECT text FROM search_query sq
JOIN ticker t ON sq.ticker_id = t.id
WHERE t.symbol = 'DSSA'
ORDER BY sq.created_at DESC;

-- Check collected articles
SELECT title, url, created_at FROM data_source
WHERE ticker_id = (SELECT id FROM ticker WHERE symbol = 'DSSA')
ORDER BY created_at DESC;

-- Check extracted entities for DSSA
SELECT e.canonical_name, et.name as type, te.relevance_weight
FROM ticker_entity te
JOIN entity e ON te.entity_id = e.id
JOIN entity_type et ON e.type_id = et.id
WHERE te.ticker_id = (SELECT id FROM ticker WHERE symbol = 'DSSA')
ORDER BY te.relevance_weight DESC;

-- Check article scores
SELECT ds.title, ar.score, ar.selected, ar.score_breakdown
FROM article_relevance ar
JOIN data_source ds ON ar.data_source_id = ds.id
WHERE ar.ticker_id = (SELECT id FROM ticker WHERE symbol = 'DSSA')
ORDER BY ar.score DESC;
```

## Dependencies

- All KG-DATA tickets completed
- All KG-AGENTS tickets completed
- KG-INT-01 completed
