---
name: prisma-strong-typing
description: Write strongly typed Prisma code using generated Prisma args/payload helpers, typed delegate DI, and typed Vitest mocking patterns. Use when creating or updating Prisma queries, Prisma service layers, or tests around Prisma-backed code.
---

# Prisma Strong Typing

Use this skill whenever code touches Prisma queries or Prisma-backed services.

## 1) Use Prisma-generated types first

- Import Prisma types from the workspace database package:
  - `import type { Prisma } from "@mediapulse/database";` (or `@hermes/orchestration-database` for orchestration models)
- Type query objects with `satisfies`:
  - `const args = { ... } satisfies Prisma.DataSourceFindManyArgs;`
- Type query payloads with `GetPayload`:
  - `type Row = Prisma.DataSourceGetPayload<{ include: { articleRelevances: { select: { score: true } } } }>;`

## 2) Type DI with delegate method picks

Prefer minimal but strict delegate contracts for testability.

```ts
type ContentGenerationDb = {
  dataSource: Pick<typeof prisma.dataSource, "findMany">;
  newsletter: Pick<typeof prisma.newsletter, "create">;
};
```

This keeps production defaults simple while allowing focused fakes in tests.

## 3) Keep callbacks and transforms typed

If strict mode cannot infer callback parameters, type from Prisma payload aliases.

```ts
type DataSourceWithScore = Prisma.DataSourceGetPayload<{
  include: { articleRelevances: { select: { score: true } } };
}>;

rows.sort((left: DataSourceWithScore, right: DataSourceWithScore) => ...);
```

## 4) Testing patterns (Vitest)

- Use `vi.mocked(fn)` before `.mockResolvedValue(...)`.
- Keep casts local and narrow in tests only.
- Prefer fixture factories that satisfy required model fields.

```ts
vi.mocked(service.getDataSourcesForTicker).mockResolvedValue([fixture]);
```

## 5) Anti-patterns

- Hand-written deep Prisma arg/result object types.
- Broad app-code casts like `as unknown as PrismaClient`.
- `any` in Prisma service layers or query mappers.

## 6) Final check

After edits:

1. Ensure no implicit `any` in callbacks.
2. Ensure query objects use `satisfies Prisma.<...>Args`.
3. Ensure payload aliases come from `Prisma.<Model>GetPayload<...>`.
4. Run `pnpm code-quality`.
