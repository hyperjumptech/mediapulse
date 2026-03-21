# @workspace/agent-runtime

Shared runtime for agents that are invoked by Hermes: standard Hono app with bearer auth and request validation.

## How Hermes invokes agents

Hermes runs pipelines of one or more agents (periodically or manually). For each pipeline step it sends:

- **Method:** `POST`
- **Body:** `{ tickerId: "<uuid>" }` (and optionally more fields if the agent schema allows)
- **Header:** `Authorization: Bearer <jwt>` (short-lived token from `POST /api/token`)

Agents must validate the body, verify the token, run their logic, and return a consistent JSON response.

## Using the runtime

### 1. Create an agent app with `createAgentApp`

Supply an **agent id**, **version**, a **Zod input schema** (at least `tickerId` for pipeline compatibility), and a **run function** that receives `{ input, token }` and returns an `AgentResult`:

```ts
import { createAgentApp } from "@workspace/agent-runtime";
import { z } from "zod";

const BodySchema = z.object({ tickerId: z.string().uuid() });
type Input = z.infer<typeof BodySchema>;

const app = createAgentApp<Input, typeof BodySchema>(
  {
    agentId: "my-agent",
    agentVersion: "1.0.0",
    inputSchema: BodySchema,
    run: async ({ input, token }) => {
      // Your logic here. Use token for agent-data-api calls.
      return { success: true };
    },
  },
  { authApiUrl: env.AGENT_AUTH_API_URL },
);

export default { port: env.PORT ?? 4000, fetch: app.fetch };
```

### 2. Agent result and response shape

- **Success:** `return { success: true }` → HTTP 200, body `{ agentId, agentVersion }`.
- **Failure / skipped:** `return { success: false, statusCode?: number, skipped?: boolean, message?: string }` → that status code and body with `agentId`, `agentVersion`, and any `skipped` / `message`.
- **Throw:** Any thrown error is logged and the client gets 500 and `{ message: "Internal Server Error" }`.

Validation errors (invalid body) return 400 with a structured error payload.

### 3. Calling the agent-data-api from `run`

Use `@workspace/agent-data-api-client` for typed API access:

```ts
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp } from "@workspace/agent-runtime";

// Inside run():
const dataApiClient = createAgentDataApiClient({
  baseUrl: env.AGENT_DATA_API_URL,
  token,
});

const data = await dataApiClient.dataCollection.get({
  tickerId: input.tickerId,
});
// ...
await dataApiClient.contentGeneration.create({
  subject: "Daily update",
  content: "Newsletter body",
  tickerId: input.tickerId,
});
```

The client includes response validation and uses shared contract schemas and route manifest entries.

### 4. Options (DI for tests)

`createAgentApp(config, options)` accepts:

- **`authApiUrl`** — Used by the default token verifier (`verifyTokenViaAuthApi`). Required in production when not supplying `verifyToken`.
- **`verifyToken`** — Custom `(token: string) => Promise<boolean>`. Overrides the default.
- **`logger`** — Logger-like instance (`{ error(obj, msg?) }`). Defaults to `@workspace/logger`.
- **`autoRegister`** — Optional `{ registryUrl, schedulerApiKey, agentUrl, fetchFn?, tokenFetchFn? }`. When set with **`authApiUrl`**, mints a JWT via `createAgentTokenClient` (scheduler API key → `POST /api/token`) and registers with agent-registry-api. The key must have purpose **`scheduler`** in the Hermes dashboard.

## Types

- **`AgentResult`** — `{ success: true }` or `{ success: false, statusCode?, skipped?, message? }`.
- **`AgentRunContext<TInput>`** — `{ input: TInput, token: string | undefined }`.
- **`AgentConfig<TInput, TSchema>`** — `agentId`, `agentVersion`, `inputSchema`, `run`.
- **`CreateAgentAppOptions`** — `authApiUrl?`, `verifyToken?`, `logger?`, `autoRegister?`.
- **`LoggerLike`** — Minimal logger interface for DI.
