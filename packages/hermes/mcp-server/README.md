# @hermes/mcp-server

Stdio MCP server for [Hermes dashboard](https://github.com/hyperjumptech/mediapulse) read APIs. Cursor (and other MCP clients) can inspect agents, schedules, pipelines, executions, and related configuration using API keys issued in the Hermes UI.

## Install and run

From the monorepo root:

```bash
pnpm install
pnpm --filter @hermes/mcp-server build
pnpm --filter @hermes/mcp-server start
```

Development (no build step):

```bash
pnpm --filter @hermes/mcp-server dev
```

The server speaks MCP over **stdio** (stdin/stdout). Do not log or print to stdout except MCP protocol messages.

## Profiles

Each profile is a Hermes base URL plus API key, loaded from environment variables (typically Cursor MCP secrets):

| Variable                             | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `HERMES_MCP_PROFILE_<NAME>_BASE_URL` | Hermes origin, e.g. `https://hermes.example.com`            |
| `HERMES_MCP_PROFILE_<NAME>_API_KEY`  | Bearer token from Hermes → API keys                         |
| `HERMES_MCP_ACTIVE_PROFILE`          | Optional; which `<NAME>` to use when several profiles exist |

Example:

```bash
export HERMES_MCP_PROFILE_PROD_BASE_URL="https://hermes.prod.example.com"
export HERMES_MCP_PROFILE_PROD_API_KEY="hermes_…"
export HERMES_MCP_PROFILE_STAGING_BASE_URL="https://hermes.staging.example.com"
export HERMES_MCP_PROFILE_STAGING_API_KEY="hermes_…"
export HERMES_MCP_ACTIVE_PROFILE="prod"
```

If only one profile is configured, it is selected automatically. Use MCP tools `hermes_list_profiles` and `hermes_set_active_profile` to inspect or switch profiles in-process.

**Security:** API keys are never written to logs or tool output.

## Cursor `mcp.json` example

```json
{
  "mcpServers": {
    "hermes": {
      "command": "pnpm",
      "args": ["--filter", "@hermes/mcp-server", "start"],
      "env": {
        "HERMES_MCP_ACTIVE_PROFILE": "prod",
        "HERMES_MCP_PROFILE_PROD_BASE_URL": "https://hermes.example.com",
        "HERMES_MCP_PROFILE_PROD_API_KEY": "${env:HERMES_PROD_API_KEY}"
      }
    }
  }
}
```

Use Cursor secret substitution or your OS env for `HERMES_PROD_API_KEY`; do not commit keys.

## Tools → HTTP

| MCP tool                              | HTTP | Path                                                      |
| ------------------------------------- | ---- | --------------------------------------------------------- |
| `hermes_ping`                         | GET  | `/api/mcp/whoami`                                         |
| `hermes_get_agent_schemas`            | GET  | `/api/agents/{agentId}/{agentVersion}/schemas`            |
| `hermes_get_pipeline_schemas`         | GET  | `/api/pipelines/{pipelineId}/schemas`                     |
| `hermes_get_schedule_execution`       | GET  | `/api/schedules/{scheduleId}/executions/{executionId}`    |
| `hermes_get_http_trigger_execution`   | GET  | `/api/http-triggers/{triggerId}/executions/{executionId}` |
| `hermes_get_pipeline_execution`       | GET  | `/api/pipelines/{pipelineId}/executions/{executionId}`    |
| `hermes_get_variable`                 | POST | `/dashboard/variables/actions/get`                        |
| `hermes_get_agent_config`             | POST | `/dashboard/agent-configs/actions/get`                    |
| `hermes_list_agents`                  | GET  | `/api/agents`                                             |
| `hermes_list_schedules`               | GET  | `/api/schedules`                                          |
| `hermes_list_pipelines`               | GET  | `/api/pipelines`                                          |
| `hermes_list_http_triggers`           | GET  | `/api/http-triggers`                                      |
| `hermes_list_variables`               | GET  | `/api/variables`                                          |
| `hermes_list_agent_configs`           | GET  | `/api/agent-configs`                                      |
| `hermes_list_domain_integrations`     | GET  | `/api/domain-integrations`                                |
| `hermes_list_content_generation_runs` | GET  | `/api/agents/content-generation-runs`                     |
| `hermes_get_content_generation_run`   | GET  | `/api/agents/content-generation-runs/{id}`                |
| `hermes_list_profiles`                | —    | Lists configured profile names (no HTTP)                  |
| `hermes_set_active_profile`           | —    | Switches active profile in-process                        |

List tools accept optional `limit` and `cursor` query parameters. `hermes_list_content_generation_runs` also accepts `outcome` and `tickerId`.

Wrong or revoked API keys return Hermes error JSON in the tool result (`isError: true`).

## Tests

```bash
pnpm --filter @hermes/mcp-server test
pnpm --filter @hermes/mcp-server test:coverage
```

Tests mock `fetch`; no real network calls in CI.
