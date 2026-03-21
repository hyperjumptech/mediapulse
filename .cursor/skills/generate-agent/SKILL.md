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

## Workflow (run in order)

1. Generate: `pnpm turbo gen agent --args <agent-name>` (or `pnpm gen:agent` and enter name when prompted).
2. Install: `pnpm install` (use `--no-frozen-lockfile` if needed).
3. Env and key: `./setup-agent-env.sh <agent-name>` — **always run this** so the agent gets `.env`/`.env.local` and `AGENT_API_KEY` (scheduler; get or create).

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
- **`packages/env/`** — New `env.agents.<name>.example` with a **unique PORT** (next free port after existing agents, base 4010), new build script, and export `./agents-<name>`. `AGENT_PUBLIC_URL` is set to `http://localhost:<PORT>`.
- **Root `package.json`** — New script `dev:agent-<name>` (e.g. `pnpm dev:agent-my-agent`).

## After generation (mandatory): install and env setup

**You must run these steps automatically** right after the generator succeeds:

1. **Install** — Run `pnpm install` (use `--no-frozen-lockfile` if the lockfile is frozen) so the new workspace is in the lockfile.
2. **Env and API key** — Run:
   ```bash
   ./setup-agent-env.sh <agent-name>
   ```
   This runs `dev-bootstrap.sh` (so the agent gets `.env` and `.env.local` from `env.agents.<name>.example` with the correct PORT), then **gets or creates** `AGENT_API_KEY` (scheduler) and sets it in the agent’s `.env.local`. Key creation is automatic when an existing key is found in another agent’s `.env.local` or in `packages/mediapulse/env/.env`, or when `ADMIN_EMAIL` is set in `packages/env/.env`. If no key exists and no `ADMIN_EMAIL` is available, the script exits with instructions; then run again with `--admin-email <email>` or after `./dev-setup-local.sh`.
3. **Optional args for `setup-agent-env.sh`** — `--no-bootstrap` (skip bootstrap if .env already set up), `--admin-email EMAIL` (use when creating a new key and not in env), `--key-name NAME` (name for the new API key).

## After generation: what to customize

1. **Input and config** — In `src/index.ts`, replace or extend the Zod `InputSchema` and add `configSchema` on `createAgentApp` if the agent has config.
2. **Run logic** — Implement `run`; it receives `{ input, config, token }` and returns `Promise<AgentResult>` (e.g. `{ success: true }` or `{ success: false, statusCode, message }`).

## Reference

- Minimal template: **ticker-echo** — `apps/agents/ticker-echo/src/index.ts`.
- Generator config: `turbo/generators/config.ts`; templates: `turbo/generators/templates/agent/`.
- Env setup: `./setup-agent-env.sh <agent-name>` — bootstrap + get/create `AGENT_API_KEY` (scheduler).
- Dev-docs: [Generate a new agent](/apps/agents/generate-agent) in the docs site.
