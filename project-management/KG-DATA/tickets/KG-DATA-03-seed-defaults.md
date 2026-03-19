# KG-DATA-03: Seed Default Entity Types and Relation Types

## Type

Feature

## Priority

High (agents need these to function)

## Description

Create a seed script that inserts default `EntityType` and `RelationType` rows so the system works out of the box. These are the initial vocabulary that the analysis agent injects into LLM prompts. Admins can later add/edit/remove via the Hermes dashboard (KG-ADMIN epic).

## Acceptance criteria

- [ ] Seed script created at `apps/hermes/scripts/seed-kg-vocabulary.ts` (following existing `seed-default-schedule.ts` pattern)
- [ ] Script is idempotent (upserts by `name`, safe to run multiple times)
- [ ] Default entity types seeded (see data below)
- [ ] Default relation types seeded (see data below)
- [ ] Script can be run standalone: `pnpm tsx apps/hermes/scripts/seed-kg-vocabulary.ts`
- [ ] JSDoc on the seed function
- [ ] Unit test for the seed function with a fake DB client

## Default entity types

| name    | description                                                                    |
| ------- | ------------------------------------------------------------------------------ |
| COMPANY | A registered business, corporation, or organization                            |
| PERSON  | An individual such as an executive, regulator, or analyst                      |
| TOPIC   | A recurring theme, policy, or subject area (e.g. DMO, ESG, inflation)          |
| EVENT   | A time-bound occurrence such as an earnings release, IPO, or regulatory change |
| PRODUCT | A specific product, service, or brand                                          |
| SECTOR  | An industry, market segment, or economic sector                                |

## Default relation types

| name          | description                                                |
| ------------- | ---------------------------------------------------------- |
| CEO_OF        | Person is the CEO or top executive of a company            |
| SUBSIDIARY_OF | Company is a subsidiary or child entity of another company |
| PARENT_OF     | Company is the parent or holding entity of another company |
| COMPETITOR    | Companies compete in the same market or segment            |
| SECTOR_PEER   | Companies operate in the same industry sector              |
| INVESTOR_IN   | Entity has invested in or holds a stake in another entity  |
| PARTNER_OF    | Entities have a business partnership or collaboration      |

## Files to create

- `apps/hermes/scripts/seed-kg-vocabulary.ts`
- `apps/hermes/scripts/seed-kg-vocabulary.test.ts`

## Notes

- Follow the pattern in `apps/hermes/scripts/seed-default-schedule.ts` for structure and DB access.
- Use `prisma.entityType.upsert({ where: { name }, create: {...}, update: {...} })` for idempotency.
