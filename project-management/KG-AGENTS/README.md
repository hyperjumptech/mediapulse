# KG-AGENTS: Query-Analysis and Analysis Agents

## Summary

Build two new agents that power the knowledge graph:

1. **query-analysis** — Uses ticker metadata + KG context to generate search query strings via LLM. Replaces the current gap where SearchQuery records have no creation code.
2. **analysis** — Extracts entities from collected articles, builds/updates the per-ticker KG, scores articles for relevance, and selects the top articles for the newsletter.

Each agent includes:

- The agent app itself (in `apps/agents/<name>/`)
- API routes in `agent-data-api` (GET for reading, POST for writing)
- Shared type schemas in `packages/agent-types`
- Environment configuration via `packages/env`

## Agent communication

Agents do not pass data directly. They communicate through the shared Postgres DB via `agent-data-api`:

```
query-analysis --writes--> search_query
data-collection --reads--> search_query, --writes--> data_source
analysis --reads--> data_source, entity_type, relation_type
         --writes--> entity, entity_alias, ticker_entity, entity_relation, article_entity, article_relevance
content-generation --reads--> data_source (filtered by article_relevance.selected)
```

## Dependencies

- KG-DATA (tables must exist)
- KG-ADMIN (entity types and relation types should be seeded, though seed script from KG-DATA is sufficient for development)
