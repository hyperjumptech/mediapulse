# @workspace/agent-runtime

Shared runtime for agents that are invoked by Hermes: standard Hono app with bearer auth and request validation.

## How Hermes invokes agents

Hermes runs pipelines of one or more agents (periodically or manually). For each pipeline step it sends:

- **Method:** `POST`
- **Body:** `{ tickerId: "<uuid>" }` (and optionally more fields if the agent schema allows)
- **Header:** `Authorization: Bearer <jwt>` (short-lived token from `POST /api/token`)

Agents validate the body, verify the token, run their logic, and return a small result object.

## Using the runtime

### 1. Create an agent app with `createAgentApp`

Supply an **agent id**, **version**, a **Zod input schema** (at least `tickerId` for pipeline compatibility), and a **run function** that receives `{ input, config, token }` and returns **`AgentRunResult`**:

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
      return { success: true };
    },
  },
  { authApiUrl: env.AGENT_AUTH_API_URL },
);

export default { port: env.PORT ?? 4000, fetch: app.fetch };
```

### 2. Agent result → HTTP

| Return                                                       | HTTP response                                             |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| `{ success: true }` or `{ success: true, message?: string }` | **200** + Hermes envelope `status: "success"`             |
| `{ success: false, message: string }`                        | **200** + envelope `status: "failure"` (business outcome) |
| **Throw**                                                    | **500** + `{ message: "Internal Server Error" }`          |

Validation errors on the request body return **400** with a structured payload.

### 3. Calling the agent-data-api from `run`

Use `@workspace/agent-data-api-client` for typed API access:

```ts
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp } from "@workspace/agent-runtime";

const dataApiClient = createAgentDataApiClient({
  baseUrl: env.AGENT_DATA_API_URL,
  token,
});
```

### 4. Options (DI for tests)

`createAgentApp(config, options)` accepts:

- **`authApiUrl`** — Used by the default token verifier (`verifyTokenViaAuthApi`). Required in production when not supplying `verifyToken`.
- **`verifyToken`** — Custom `(token: string) => Promise<boolean>`.
- **`logger`** — Logger-like instance (`{ error(obj, msg?) }`). Defaults to `@workspace/logger`.
- **`autoRegister`** — Optional registry self-registration on startup.

## Types

- **`AgentRunResult`** — `{ success: true; message?: string }` \| `{ success: false; message: string }`
- **`HermesInvokeEnvelopeV1`** — JSON body on 200 (see `invoke-envelope.ts`).
- **`AgentRunContext<TInput, TConfig>`** — `{ input, config, token }`.
- **`AgentConfig`** — `agentId`, `agentVersion`, `inputSchema`, optional `configSchema`, `run`.
