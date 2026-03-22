# ticker-echo

Minimal agent for **local scheduler testing**. Accepts `tickerId` as input, optional `verbose` config for logging, and returns success. No side effects—safe to run with the hermes-worker DataQueue flow (check_schedules → invoke_agent).

## Input

- **input.tickerId** (string, required)

## Local testing (no agent-auth-api)

1. Copy `.env.example` to `.env.local` and set `ALLOW_ANY_BEARER_FOR_LOCAL=true`.
2. In Hermes, register the agent in the registry (or insert into `agent_registry`):
   - **Agent ID:** `ticker-echo`
   - **Version:** `1.0.0`
   - **Endpoint:** `{ "url": "http://localhost:4010", "method": "POST" }`
   - **Input schema:** `{ "type": "object", "properties": { "tickerId": { "type": "string" } }, "required": ["tickerId"] }`
3. Create a pipeline with one step: agent `ticker-echo@1.0.0`, input e.g. `{ "tickerId": "{{tickerId}}" }` or a data source.
4. Create a schedule for that pipeline (or use “Run pipeline”).
5. Start the agent: `pnpm --filter @mediapulse/ticker-echo dev`.
6. Start hermes-worker (and optionally Hermes). When the scheduler runs, set step config `{ "verbose": true }` to see log lines like `--> ticker-echo received verbose` for each invocation.

Set the same **`HERMES_INTERNAL_API_KEY`** in hermes-worker as in `packages/hermes/env/.env` when using the real auth API (or any non-empty string in worker when `ALLOW_ANY_BEARER_FOR_LOCAL=true` for local-only bypass).

## With agent-auth-api

Set `ALLOW_ANY_BEARER_FOR_LOCAL=false` (or omit it), set `AGENT_AUTH_API_URL` to your auth API, and set **`HERMES_INTERNAL_API_KEY`** on hermes-worker (preset shared with dashboard and agent-auth-api).

## Scripts

- `pnpm dev` — Run with hot reload (Bun). Uses `.env.local` and `.env`.
- `pnpm build` / run the built server for production.
- `pnpm type:check` — TypeScript check.
- `pnpm test` — Run tests.

From repo root: `pnpm --filter @mediapulse/ticker-echo dev`.
