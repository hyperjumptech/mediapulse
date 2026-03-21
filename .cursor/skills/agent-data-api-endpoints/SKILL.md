---
name: agent-data-api-endpoints
description: Handle agent-data-api endpoint additions, deletions, and request or response shape updates by synchronizing contract schemas, manifest resources, server handlers, SDK methods, agent consumers, tests, and docs.
---

# Agent Data API Endpoint Changes

Use this skill when changing `agent-data-api` HTTP endpoints.

## Checklist

1. Update `@workspace/agent-data-api-contract` schemas and exported types first.
2. Update `apps/mediapulse/agent-data-api` routes/services to use the updated contract.
3. Update or add the resource in `agentDataApiManifest` in `@workspace/agent-data-api-contract`.
4. For versioned routes, keep `AGENT_DATA_API_LIVE_VERSIONS` and `agentDataApiManifestForVersion(...)` aligned with nested `agentDataApiManifest` entries.
5. Update `apps/mediapulse/agent-data-api` handlers and the typed handler map used by route registration.
6. Update `@workspace/agent-data-api-client` behavior and response parsing when needed.
7. Update agent callers to use typed SDK methods and contract-backed types.
8. Update/extend tests for server routes/services, SDK methods, and agents.
9. Update `dev-docs/docs/mediapulse/apps/agent-data-api.mdx`.
10. Run `pnpm code-quality`.

## New endpoint

1. Add query/body/response schemas and inferred types in `@workspace/agent-data-api-contract`.
2. Add the new resource to `agentDataApiManifest` (do not hardcode route strings in app/client code).
3. Implement route/service handlers in `apps/mediapulse/agent-data-api/src/routes` and `apps/mediapulse/agent-data-api/src/services`.
4. Add the resource handlers to the typed handler map used by `registerAgentDataApiRoutes`.
5. Update consuming agents to call the SDK resource namespace (no raw path strings).
6. Add tests for route/service/SDK/agent behavior.

## Update endpoint shape

1. Change contract schema first.
2. Fix all compile errors in manifest, server, SDK, and agents.
3. Ensure SDK response parsing matches the new schema.
4. Update tests for old and new behavior as needed.

## Delete endpoint

1. Remove the resource from `agentDataApiManifest`.
2. Remove route/service files or dead handlers.
3. Remove contract schema/types if no longer used.
4. Remove SDK usages and any agent callsites.
5. Remove or update docs references and tests.

## Related standards

- `.cursor/rules/read-rules-and-skills-first.mdc`
- `.cursor/rules/typescript-javascript-standards.mdc`
- `.cursor/rules/prisma-strong-typing.mdc`
- `.cursor/rules/run-code-quality-after-changes.mdc`
- `.cursor/rules/env-variables.mdc`
