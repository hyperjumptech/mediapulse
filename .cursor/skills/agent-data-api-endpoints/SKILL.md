---
name: agent-data-api-endpoints
description: Handle agent-data-api endpoint additions, deletions, and request or response shape updates by synchronizing contract schemas, server routes, SDK methods, agent consumers, tests, and docs.
---

# Agent Data API Endpoint Changes

Use this skill when changing `agent-data-api` HTTP endpoints.

## Checklist

1. Update `@workspace/agent-data-api-contract` schemas and exported types first.
2. Update `apps/agent-data-api` routes/services to use the updated contract.
3. Update `@workspace/agent-data-api-client` endpoint methods and response parsing.
4. Update agent callers to use typed SDK methods and contract-backed types.
5. Update/extend tests for server routes/services, SDK methods, and agents.
6. Update `dev-docs/docs/apps/agent-data-api.mdx`.
7. Run `pnpm code-quality`.

## New endpoint

1. Add query/body/response schemas and inferred types in `@workspace/agent-data-api-contract`.
2. Implement route/service handlers in `apps/agent-data-api/src/routes` and `apps/agent-data-api/src/services`.
3. Register route in `apps/agent-data-api/src/index.ts`.
4. Add a typed method in `@workspace/agent-data-api-client`.
5. Update consuming agents to call the new SDK method.
6. Add tests for route/service/SDK/agent behavior.

## Update endpoint shape

1. Change contract schema first.
2. Fix all compile errors in server, SDK, and agents.
3. Ensure SDK response parsing matches the new schema.
4. Update tests for old and new behavior as needed.

## Delete endpoint

1. Remove route registration in `apps/agent-data-api/src/index.ts`.
2. Remove route/service files or dead handlers.
3. Remove contract schema/types.
4. Remove SDK methods and any agent callsites.
5. Remove or update docs references and tests.

## Related standards

- `.cursor/rules/read-rules-and-skills-first.mdc`
- `.cursor/rules/typescript-javascript-standards.mdc`
- `.cursor/rules/prisma-strong-typing.mdc`
- `.cursor/rules/run-code-quality-after-changes.mdc`
- `.cursor/rules/env-variables.mdc`
