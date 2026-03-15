---
name: generate-agent
description: Generate a new agent package from the minimal ticker-echo template using Turbo Gen. Use when the user asks to create a new agent, scaffold an agent, generate an agent package, add an agent, or mentions turbo gen agent / gen:agent.
---

# Generate a New Agent Package

New agents are scaffolded with **Turbo Gen** from the **ticker-echo** minimal template. Devs only define the request body, config schema, and the agent’s `run` logic in `src/index.ts`.

## When to use this skill

- User asks to create a new agent, scaffold an agent, or generate an agent package.
- User wants to add another agent to `apps/agents/`.
- User mentions `turbo gen agent`, `gen:agent`, or “minimal agent template”.

## Command

From the repo root:

```bash
pnpm gen:agent
```

Or pass the agent name to skip the prompt:

```bash
pnpm turbo gen agent --args my-agent
```

The prompt asks for an **agent name** in kebab-case (e.g. `my-agent`). The generator creates `apps/agents/<name>/` and wires `@workspace/env`.

## What gets created

- **`apps/agents/<name>/`** — New agent package:
  - `package.json` — name `<name>-agent`, same scripts and deps as ticker-echo.
  - `src/index.ts` — `createAgentApp` with placeholder `InputSchema` (`payload: z.string()`), minimal `run`, and env from `@workspace/env/agents-<name>`.
  - `src/index.test.ts` — GET /schemas test.
  - `tsconfig.json`, `turbo.json`, `vitest.config.ts`.
- **`packages/env/`** — New `env.agents.<name>.example`, new build script, and export `./agents-<name>`.
- **Root `package.json`** — New script `dev:agent-<name>` (e.g. `pnpm dev:agent-my-agent`).

## After generation: what to customize

1. **Input and config** — In `src/index.ts`, replace or extend the Zod `InputSchema` and add `configSchema` on `createAgentApp` if the agent has config.
2. **Run logic** — Implement `run`; it receives `{ input, config, token }` and returns `Promise<AgentResult>` (e.g. `{ success: true }` or `{ success: false, statusCode, message }`).
3. **Env** — In the new agent dir, copy `packages/env/env.agents.<name>.example` to `.env.local` and set `PORT`, `AGENT_AUTH_API_URL`, and optionally registry URL/key for auto-registration.

## Reference

- Minimal template: **ticker-echo** — `apps/agents/ticker-echo/src/index.ts`.
- Generator config: `turbo/generators/config.ts`; templates: `turbo/generators/templates/agent/`.
- Dev-docs: [Generate a new agent](/apps/agents/generate-agent) in the docs site.
