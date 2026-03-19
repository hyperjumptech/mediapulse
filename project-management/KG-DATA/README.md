# KG-DATA: Knowledge Graph Data Model

## Summary

Add the Prisma schema, migration, seed data, and data-access layer for the per-ticker knowledge graph. This epic is the foundation — all other epics depend on it.

## Tables introduced

| Table               | Purpose                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| `entity_type`       | Admin-managed vocabulary for entity classification (COMPANY, PERSON, TOPIC, ...)      |
| `relation_type`     | Admin-managed vocabulary for relationship classification (CEO_OF, SUBSIDIARY_OF, ...) |
| `entity`            | A real-world thing (person, company, topic, event, etc.)                              |
| `entity_alias`      | Alternative names for an entity, used for fuzzy matching                              |
| `ticker_entity`     | Per-ticker KG membership — which entities belong to which ticker's graph              |
| `entity_relation`   | Edges between entities (e.g. "GEMS is SUBSIDIARY_OF DSSA")                            |
| `article_entity`    | Which entities appear in which article (DataSource)                                   |
| `article_relevance` | Relevance score per article per ticker, with selection flag                           |

## Dependencies

- None (this is the first epic to implement)

## Blocked by this epic

- KG-ADMIN (needs the tables to exist)
- KG-AGENTS (needs the tables to exist)
- KG-INTEGRATION (needs article_relevance to exist)
