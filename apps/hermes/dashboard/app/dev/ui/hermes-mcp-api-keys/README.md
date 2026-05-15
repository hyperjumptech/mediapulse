# Hermes MCP API keys UI fixture (#496)

## Prerequisites

- Postgres with orchestration migrations applied
- `packages/hermes/env/.env` includes `HERMES_MCP_API_KEY_PEPPER` and other required vars
- From repo root: `pnpm dev:hermes` (dashboard on port 3001)

## URLs

- Empty list: http://localhost:3001/dev/ui/hermes-mcp-api-keys?variant=empty
- List with sample row: http://localhost:3001/dev/ui/hermes-mcp-api-keys?variant=list
- Create modal (open): http://localhost:3001/dev/ui/hermes-mcp-api-keys?variant=create-modal

Production page (requires login): http://localhost:3001/dashboard/api-keys

## Capture

From `apps/hermes/dashboard`:

```bash
pnpm simulate:api-keys-ui
```

Screenshots are written under `artifacts/ui-evidence/hermes-mcp-496/` (gitignored).
