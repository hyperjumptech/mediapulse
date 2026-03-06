# @workspace/agent-runtime

Shared runtime for agents that are invoked by Hermes: standard Hono app with bearer auth, request validation, and helpers for calling the agent-data-api.

## How Hermes invokes agents

Hermes runs pipelines of one or more agents (periodically or manually). For each pipeline step it sends:

- **Method:** `POST`
- **Body:** `{ tickerId: "<uuid>" }` (and optionally more fields if the agent schema allows)
- **Header:** `Authorization: Bearer <apiKey>`

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

Use **`dataApiGet`** and **`dataApiPost`** so all agents use the same token and base URL pattern:

```ts
import {
  createAgentApp,
  dataApiGet,
  dataApiPost,
} from "@workspace/agent-runtime";

// Inside run():
const data = await dataApiGet<MyType>(
  token,
  env.AGENT_DATA_API_URL,
  "/api/my-agent",
  { tickerId: input.tickerId },
);
// ...
await dataApiPost(token, env.AGENT_DATA_API_URL, "/api/my-agent", payload);
```

Both helpers add the `Authorization` header when `token` is present and throw if the response status is not 2xx.

### 4. Options (DI for tests)

`createAgentApp(config, options)` accepts:

- **`authApiUrl`** — Used by the default token verifier (`verifyTokenViaAuthApi`). Required in production when not supplying `verifyToken`.
- **`verifyToken`** — Custom `(token: string) => Promise<boolean>`. Overrides the default.
- **`logger`** — Logger-like instance (`{ error(obj, msg?) }`). Defaults to `@workspace/logger`.

## Types

- **`AgentResult`** — `{ success: true }` or `{ success: false, statusCode?, skipped?, message? }`.
- **`AgentRunContext<TInput>`** — `{ input: TInput, token: string | undefined }`.
- **`AgentConfig<TInput, TSchema>`** — `agentId`, `agentVersion`, `inputSchema`, `run`.
- **`CreateAgentAppOptions`** — `authApiUrl?`, `verifyToken?`, `logger?`.
- **`LoggerLike`** — Minimal logger interface for DI.
