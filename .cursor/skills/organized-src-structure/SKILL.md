---
name: organized-src-structure
description: >-
  Monorepo-wide conventions for folder layout under packages/ and apps/: types, lib,
  hooks, components, barrels, co-located tests. Use when creating files, refactoring
  structure, or scaffolding a package or app feature.
---

# Organized source structure (Mediapulse monorepo)

Apply when adding or reorganizing code under `packages/**` or `apps/**`.

## Goals

- **Discoverability**: a reader finds types, logic, hooks, and UI without scanning a flat list.
- **Consistency**: new code matches the dominant pattern in that package or app.
- **Tests**: live next to the code they cover (unless that area already uses another pattern—then follow locals).

## Packages (`packages/**`)

Under `src/` (or the package’s documented root), prefer:

```
src/
  index.ts              # Optional: public re-exports only (no business logic)
  types/index.ts        # Shared types (no React in pure type modules)
  lib/                  # Pure functions, parsers, constants
  hooks/                # use-*.ts + use-*.test.ts
  components/           # *.tsx + *.test.tsx
```

Not every package needs every folder—**mirror what already exists** in sibling files. If the package is small and flat, keep it flat until it becomes hard to navigate; then introduce folders.

**Barrels**: If the package exposes a single API via `package.json` `exports`, keep `index.ts` as a thin export surface.

## Apps (`apps/**`)

- **Next.js App Router**: respect `app/`, `components/`, `lib/`, `actions/` (or generated route/action layouts) as already used in that app.
- **New UI**: default to the same `components/` (or feature folder) pattern as nearby pages.
- **Shared app helpers**: `lib/` or `utils/` per existing app convention.

## Naming

- **kebab-case** filenames (see workspace TypeScript standards).
- Hooks: `use-something.ts`.

## Imports

- Extensionless relative paths for local modules in TS source packages.
- Use workspace aliases (`@workspace/...`, `@hermes/...`, `@mediapulse/...`) per app/package config.

## Verification

After structural or import changes: run the relevant package/app `pnpm lint`, `pnpm type:check`, and tests; from repo root, `pnpm code-quality` when touching TS/JS tests broadly.

## Related

- Cursor rule: `.cursor/rules/organized-src-structure.mdc`
- TypeScript/JavaScript standards: `.cursor/rules/typescript-javascript-standards.mdc`
- React hooks: `.cursor/rules/react-custom-hooks.mdc`
