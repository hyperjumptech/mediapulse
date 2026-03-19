# KG-INT-02: Create 3 Pipelines and Schedules

## Type

Feature

## Priority

Medium (can be done last, after all agents work)

## Description

Create the 3 independent pipelines in Hermes with their schedules, so the full system runs automatically:

- **Pipeline A** (query-analysis): daily at 05:00
- **Pipeline B** (data-collection): 4x/day at 06:00, 10:00, 14:00, 18:00
- **Pipeline C** (analysis -> content-generation -> delivery): daily at 20:00

## Acceptance criteria

- [ ] Seed script creates all 3 pipelines with correct steps and schedules
- [ ] Pipeline A has 1 step: query-analysis agent
- [ ] Pipeline B has 1 step: data-collection agent
- [ ] Pipeline C has 3 steps in order: analysis (1), content-generation (2), delivery (3)
- [ ] All steps use input `{ "tickerId": "db:userTicker:tickerId?where.enabled=true" }` for fan-out
- [ ] Schedules use correct cron expressions
- [ ] Schedules reference the correct agent registry entries (agents must be registered)
- [ ] Script is idempotent (safe to run multiple times)
- [ ] Script can be run standalone
- [ ] `pnpm code-quality` passes

## Pipeline definitions

### Pipeline A: query-analysis

```
Name: "Query Analysis"
Description: "Generate search queries for each subscribed ticker using KG context"
Steps:
  1. agent: query-analysis@1.0.0, input: { "tickerId": "db:userTicker:tickerId?where.enabled=true" }
Schedule:
  Name: "Daily Query Analysis"
  Cron: "0 5 * * *"
  Timezone: "Asia/Jakarta"
  Repeat: repeating
```

### Pipeline B: data-collection

```
Name: "Data Collection"
Description: "Crawl and collect news articles for each subscribed ticker"
Steps:
  1. agent: data-collection@1.0.0, input: { "tickerId": "db:userTicker:tickerId?where.enabled=true" }
Schedule:
  Name: "4x Daily Data Collection"
  Cron: "0 6,10,14,18 * * *"
  Timezone: "Asia/Jakarta"
  Repeat: repeating
```

### Pipeline C: analysis + newsletter

```
Name: "Analysis & Newsletter"
Description: "Analyze collected articles, score relevance, generate newsletter, and deliver"
Steps:
  1. agent: analysis@1.0.0, input: { "tickerId": "db:userTicker:tickerId?where.enabled=true" }
  2. agent: content-generation@1.0.0, input: { "tickerId": "db:userTicker:tickerId?where.enabled=true" }
  3. agent: delivery@1.0.0, input: { "tickerId": "db:userTicker:tickerId?where.enabled=true" }
Schedule:
  Name: "Daily Newsletter"
  Cron: "0 20 * * *"
  Timezone: "Asia/Jakarta"
  Repeat: repeating
```

## Files to create

- `apps/hermes/scripts/seed-kg-pipelines.ts`

## Files to reference

- `apps/hermes/scripts/seed-default-schedule.ts` (existing pattern to follow)

## Dependencies

- KG-AGENTS-01 (query-analysis agent must be registered)
- KG-AGENTS-04 (analysis agent must be registered)
- All agent scaffolds must be deployed or registered via auto-register

## Notes

- The timezone is set to `Asia/Jakarta` (WIB, UTC+7) since the target audience is Indonesian market. 05:00 WIB = 22:00 UTC previous day, 20:00 WIB = 13:00 UTC.
- The `db:userTicker:tickerId?where.enabled=true` expansion fans out one agent invocation per subscribed ticker. This uses the existing expansion mechanism in `packages/hermes-scheduler/src/expand-data-sources.ts`.
- Schedules are disabled by default (`enabled: false`) in the seed so they don't fire immediately upon seeding. Enable manually in the Hermes dashboard after verifying agents work end-to-end.
