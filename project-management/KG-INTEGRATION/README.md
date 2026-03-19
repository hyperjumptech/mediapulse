# KG-INTEGRATION: Pipeline Wiring and Content-Generation Filter

## Summary

Wire the new agents into the existing pipeline/schedule system and modify content-generation to consume only relevance-scored articles instead of all articles for a ticker.

## Changes

1. **content-generation filter** — Modify `getDataSourcesForTicker` in `agent-data-api` to return only articles where `article_relevance.selected = true` and scored today.
2. **Pipeline configuration** — Create 3 pipelines in Hermes with independent schedules:
   - Pipeline A: query-analysis (daily 05:00)
   - Pipeline B: data-collection (4x/day at 06:00, 10:00, 14:00, 18:00)
   - Pipeline C: analysis -> content-generation -> delivery (daily 20:00)
3. **Schedule seed script** — Automate pipeline and schedule creation for development and production.

## Dependencies

- KG-DATA (article_relevance table must exist)
- KG-AGENTS (agents must be registered for pipeline steps to reference them)
