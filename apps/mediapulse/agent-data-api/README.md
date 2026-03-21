# agent-data-api

Hono service for agent-facing data endpoints.

## Read this first

Before changing endpoints, read:

- `dev-docs/docs/apps/agent-data-api.mdx`

That doc is the source of truth for route architecture, manifest usage, and endpoint workflow.

## Common commands

From repo root:

- `pnpm --filter @mediapulse/agent-data-api dev`
- `pnpm --filter @mediapulse/agent-data-api test`
- `pnpm --filter @mediapulse/agent-data-api type:check`

## Endpoint changes (quick workflow)

1. Add or update schemas in `@workspace/agent-data-api-contract`.
2. Add or update the resource in `agentDataApiManifest` (contract package).
3. Implement or update handlers in `apps/agent-data-api/src/routes` and services.
4. Wire handlers in `apps/agent-data-api/src/index.ts` via the typed handler map.
5. Update `@workspace/agent-data-api-client` only if request/response shapes changed.
6. Update agent consumers and tests.
7. Run `pnpm code-quality`.

## Using the Cursor skill

For endpoint additions/removals/shape changes, use:

- `.cursor/skills/agent-data-api-endpoints/SKILL.md`

The skill enforces the correct order across contract, API, SDK, agents, tests, and docs, and helps avoid route/SDK drift.
