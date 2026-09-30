# @hermes/mcp-server

Stdio MCP server for the Hermes dashboard HTTP API. Cursor, Claude Code and other MCP clients use it to read and change Hermes (agents, pipelines, schedules, HTTP triggers, variables, domain integrations and their data) with an API key issued in the Hermes UI.

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

The server speaks MCP over **stdio**. Do not log or print to stdout except MCP protocol messages. The server reports the `version` from this package's `package.json`.

## Profiles

Each profile is a Hermes base URL plus an API key, loaded from environment variables (usually MCP client secrets):

| Variable                             | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `HERMES_MCP_PROFILE_<NAME>_BASE_URL` | Hermes origin, for example `https://hermes.example.com`     |
| `HERMES_MCP_PROFILE_<NAME>_API_KEY`  | Bearer token from Hermes, API keys page                     |
| `HERMES_MCP_ACTIVE_PROFILE`          | Optional. Which `<NAME>` to use when several profiles exist |

Example:

```bash
export HERMES_MCP_PROFILE_PROD_BASE_URL="https://hermes.prod.example.com"
export HERMES_MCP_PROFILE_PROD_API_KEY="hermes_…"
export HERMES_MCP_PROFILE_STAGING_BASE_URL="https://hermes.staging.example.com"
export HERMES_MCP_PROFILE_STAGING_API_KEY="hermes_…"
export HERMES_MCP_ACTIVE_PROFILE="prod"
```

If only one profile is configured, it is selected automatically. Use `hermes_list_profiles` and `hermes_set_active_profile` to inspect or switch profiles in-process.

API keys are never written to logs or tool output.

## Toolsets

Every tool belongs to a toolset. Set `HERMES_MCP_TOOLSETS` to a comma-separated list to register only those toolsets, for MCP clients that cap how many tools they load. `core` (`hermes_ping`, `hermes_search` and the profile tools) is always registered. Unset, empty or unknown values register every toolset.

| Toolset     | Covers                                          |
| ----------- | ----------------------------------------------- |
| `core`      | API key check, search, profiles                 |
| `pipelines` | Pipelines, their steps and manual runs          |
| `schedules` | Schedules and their executions                  |
| `triggers`  | HTTP triggers and their executions              |
| `agents`    | Agent registry and agent configs                |
| `variables` | Orchestration variables                         |
| `domain`    | Domain integrations, their views and their rows |
| `admin`     | Dashboard admins and API keys                   |

```bash
export HERMES_MCP_TOOLSETS="pipelines,agents"
```

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

Use secret substitution or your OS environment for `HERMES_PROD_API_KEY`. Do not commit keys.

## List tools

Every `hermes_list_*` tool (and `hermes_list_domain_rows`) takes the same optional arguments:

| Argument   | Meaning                                                            |
| ---------- | ------------------------------------------------------------------ |
| `page`     | 1-based page number. Default 1.                                    |
| `pageSize` | Rows per page, 1 to 100. Default 20.                               |
| `q`        | Case-insensitive search. Each tool's description names the fields. |
| `sort`     | Sort field. Each tool accepts a fixed set, listed in its schema.   |
| `dir`      | `asc` or `desc`.                                                   |

They return `{ items, total, page, pageSize, hasMore }` as compact JSON text and as `structuredContent`, and declare that shape as their `outputSchema`. Ask for the next page while `hasMore` is true.

## Output

- Successful calls return the response body as compact JSON, with no wrapper.
- Failed calls are tool errors (`isError: true`) whose text is `{"status":<http status>,"body":<Hermes error body>}`. Status `0` means the request never reached Hermes (no profile, network failure).
- Mutation routes answer 400 when Hermes rejects the input. An invalid body lists each bad field in `body.issues` as `{ path, message }`. A missing record is 404, a duplicate is 409, and 500 means Hermes itself failed.
- Text is capped at about 50,000 characters. A list that would exceed the cap keeps as many whole items as fit, sets `truncated: true`, and ends with a note. Other output is cut and ends with the same note: narrow the query with a smaller `pageSize`, a `q` search, or a `hermes_get_*` tool.

## Read tools

All read tools are annotated `readOnlyHint` and `idempotentHint`.

| MCP tool                            | HTTP | Path                                                           |
| ----------------------------------- | ---- | -------------------------------------------------------------- |
| `hermes_ping`                       | GET  | `/api/mcp/whoami`                                              |
| `hermes_search`                     | GET  | `/api/dashboard-search?q=`                                     |
| `hermes_list_agents`                | GET  | `/api/agents`                                                  |
| `hermes_get_agent_schemas`          | GET  | `/api/agents/{agentId}/{agentVersion}/schemas`                 |
| `hermes_list_agent_configs`         | GET  | `/api/agent-configs`                                           |
| `hermes_get_agent_config`           | POST | `/dashboard/agent-configs/actions/get`                         |
| `hermes_list_pipelines`             | GET  | `/api/pipelines` (summaries with `stepCount`)                  |
| `hermes_get_pipeline`               | GET  | `/api/pipelines/{pipelineId}` (steps, validation, run params)  |
| `hermes_get_pipeline_schemas`       | GET  | `/api/pipelines/{pipelineId}/schemas`                          |
| `hermes_get_pipeline_execution`     | GET  | `/api/pipelines/{pipelineId}/executions/{executionId}`         |
| `hermes_list_schedules`             | GET  | `/api/schedules`                                               |
| `hermes_get_schedule_execution`     | GET  | `/api/schedules/{scheduleId}/executions/{executionId}`         |
| `hermes_list_http_triggers`         | GET  | `/api/http-triggers`                                           |
| `hermes_get_http_trigger_execution` | GET  | `/api/http-triggers/{triggerId}/executions/{executionId}`      |
| `hermes_list_variables`             | GET  | `/api/variables`                                               |
| `hermes_get_variable`               | POST | `/dashboard/variables/actions/get`                             |
| `hermes_list_domain_integrations`   | GET  | `/api/domain-integrations`                                     |
| `hermes_list_domain_views`          | GET  | `/api/domain-integrations/{integrationId}/views`               |
| `hermes_list_domain_rows`           | GET  | `/api/domain-integrations/{integrationId}/{resource}`          |
| `hermes_get_domain_row`             | GET  | `/api/domain-integrations/{integrationId}/{resource}/{itemId}` |
| `hermes_list_profiles`              | none | Lists configured profile names                                 |
| `hermes_set_active_profile`         | none | Switches the active profile in-process                         |

### Domain data

Domain integrations describe their data as resource-table views in their dashboard manifest. Read them generically:

1. `hermes_list_domain_views` with an `integrationId` lists each view's `pathSegment`, columns, `searchableFields`, `sortableFields`, `defaultSort` and filters. Each filter names the `queryKeys` it reads.
2. `hermes_list_domain_rows` with `integrationId`, `resource` (a view's `pathSegment`) and the list arguments pages through rows. `sort` must be one of the view's `sortableFields`. Pass filters as `filters: { "<queryKey>": "<value>" }`. Keys the view does not declare are ignored.
3. `hermes_get_domain_row` fetches one row by id.

## Mutation tools (`hermes_mutate_*`)

Write tools call dashboard `POST` routes with the same Bearer key. Before the first mutation, the server checks `GET /api/mcp/whoami` and blocks read-only keys. The result is cached per profile for 5 minutes. Any 401 or 403 from Hermes, or a profile switch, clears it.

Tools marked "Needs `confirm: true`" need two calls:

1. The first call without `confirm: true` returns a tool error and sends **no** HTTP request.
2. A second call with `confirm: true`, after the user approves, sends the mutation.

| MCP tool                                      | Needs `confirm: true` | Annotations             | POST path                                              |
| --------------------------------------------- | --------------------- | ----------------------- | ------------------------------------------------------ |
| `hermes_mutate_create_agent`                  | No                    | additive                | `/dashboard/agents/actions/create`                     |
| `hermes_mutate_delete_agent`                  | Yes                   | destructive, idempotent | `/dashboard/agents/actions/delete`                     |
| `hermes_mutate_create_variable`               | No                    | additive                | `/dashboard/variables/actions/create`                  |
| `hermes_mutate_delete_variable`               | Yes                   | destructive, idempotent | `/dashboard/variables/actions/delete`                  |
| `hermes_mutate_create_pipeline`               | No                    | additive                | `/dashboard/pipelines/actions/create`                  |
| `hermes_mutate_update_pipeline`               | No                    | destructive, idempotent | `/dashboard/pipelines/actions/update`                  |
| `hermes_mutate_add_agent_step`                | No                    | additive                | `/dashboard/pipelines/actions/add-step`                |
| `hermes_mutate_add_pipeline_step`             | No                    | additive                | `/dashboard/pipelines/actions/add-pipeline-step`       |
| `hermes_mutate_update_agent_step`             | No                    | destructive, idempotent | `/dashboard/pipelines/actions/update-step`             |
| `hermes_mutate_update_pipeline_step`          | No                    | destructive, idempotent | `/dashboard/pipelines/actions/update-pipeline-step`    |
| `hermes_mutate_remove_step`                   | Yes                   | destructive, idempotent | `/dashboard/pipelines/actions/remove-step`             |
| `hermes_mutate_reorder_steps`                 | No                    | destructive, idempotent | `/dashboard/pipelines/actions/reorder-steps`           |
| `hermes_mutate_run_pipeline`                  | Yes                   | destructive, open world | `/dashboard/pipelines/actions/run-pipeline`            |
| `hermes_mutate_cancel_pipeline_execution`     | Yes                   | destructive, idempotent | `/dashboard/pipelines/actions/cancel-manual-execution` |
| `hermes_mutate_delete_pipeline`               | Yes                   | destructive, idempotent | `/dashboard/pipelines/actions/delete`                  |
| `hermes_mutate_cancel_schedule_execution`     | Yes                   | destructive, idempotent | `/dashboard/schedules/actions/cancel-execution`        |
| `hermes_mutate_delete_schedule`               | Yes                   | destructive, idempotent | `/dashboard/schedules/actions/delete`                  |
| `hermes_mutate_cancel_http_trigger_execution` | Yes                   | destructive, idempotent | `/dashboard/http-triggers/actions/cancel-execution`    |
| `hermes_mutate_delete_http_trigger`           | Yes                   | destructive, idempotent | `/dashboard/http-triggers/actions/delete`              |

## Tests

```bash
pnpm --filter @hermes/mcp-server test
pnpm --filter @hermes/mcp-server test:coverage
```

Tests mock `fetch`, so CI makes no network calls. Two contract tests read the dashboard route sources:

- `list-tool-route-contract.test.ts` fails when a read tool sends a query key, sort field or path that its route does not handle.
- `mutate-tool-route-contract.test.ts` fails when a tool posts to an action route that is missing, does not accept API keys, does not read one of the tool's body keys, or requires a key the tool leaves optional.

`readme-tool-table.test.ts` fails when a registered tool is missing from this README.
