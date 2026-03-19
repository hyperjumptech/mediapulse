# KG-DATA-02: Create and Apply Database Migration

## Type

Feature

## Priority

High (blocks all other epics)

## Description

Generate and apply the Prisma migration for the knowledge graph tables added in KG-DATA-01.

## Acceptance criteria

- [ ] Migration generated using the project's `db:migrate:dev` script
- [ ] Migration file created in `packages/database/prisma/migrations/` with a descriptive name (e.g. `add_knowledge_graph_tables`)
- [ ] Migration applies cleanly on a fresh database (`pnpm db:migrate:dev`)
- [ ] Migration applies cleanly on an existing database with data (no data loss)
- [ ] `pnpm prisma generate` succeeds after migration
- [ ] `pnpm code-quality` passes

## Steps

1. Ensure KG-DATA-01 schema changes are in `schema.prisma`
2. Run the migration: `pnpm db:migrate:dev --name add_knowledge_graph_tables` (from `packages/database`)
3. Review the generated SQL to confirm all tables, indexes, and constraints are correct
4. Verify the Prisma client regenerates and type-checks

## Dependencies

- KG-DATA-01 (schema must be defined first)

## Files created

- `packages/database/prisma/migrations/<timestamp>_add_knowledge_graph_tables/migration.sql`
