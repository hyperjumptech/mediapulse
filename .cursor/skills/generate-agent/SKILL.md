---
name: generate-agent
description: Generate a new agent package from the minimal ticker-echo template using Turbo Gen. Use when the user asks to create a new agent, scaffold an agent, generate an agent package, add an agent, or mentions turbo gen agent / gen:agent.
---

# Generate a New Agent Package

New agents are scaffolded with **Turbo Gen** from the **ticker-echo** minimal template under **`apps/mediapulse/agents/`**. Devs define the request body, config schema, and the agent’s `run` logic in `src/index.ts`.

## When to use this skill

- User asks to create a new agent, scaffold an agent, or generate an agent package.
- User wants to add another agent under **`apps/mediapulse/agents/`**.
- User mentions `turbo gen agent`, `gen:agent`, or “minimal agent template”.

## Workflow (run in order)

1. Generate: `pnpm turbo gen agent --args <agent-name>` (or `pnpm gen:agent` and enter name when prompted).
2. Install: `pnpm install` (use `--no-frozen-lockfile` if needed).
3. Build env package: `pnpm --filter @mediapulse/env build` (new export for the agent).
4. Env and key: `./setup-agent-env.sh <agent-name>` — **always run this** so the agent gets `.env`/`.env.local` and `DOMAIN_INTEGRATION_API_KEY` (Hermes **domain_integration**; get or create).

## Command

From the repo root:

```bash
pnpm gen:agent
```

Or pass the agent name to skip the prompt:

```bash
pnpm turbo gen agent --args my-agent
```

The prompt asks for an **agent name** in kebab-case (e.g. `my-agent`). The generator creates **`apps/mediapulse/agents/<name>/`** with package **`@mediapulse/<name>`** and wires **`@mediapulse/env`** (`env.agents.<name>.example` + export).

## What gets created

- **`apps/mediapulse/agents/<name>/`** — New agent package (same scripts and deps as ticker-echo).
- **`packages/mediapulse/env/`** — New `env.agents.<name>.example` with a **unique PORT** (next free port after existing agents, base 4010), new build script, and export `./agents-<name>`. `AGENT_PUBLIC_URL` is set to `http://localhost:<PORT>`.
- **Root `package.json`** — New script `dev:agent-<name>` → `turbo dev --filter=@mediapulse/<name>`.

## After generation (mandatory): install and env setup

**You must run these steps automatically** right after the generator succeeds:

1. **Install** — Run `pnpm install` (use `--no-frozen-lockfile` if the lockfile is frozen) so the new workspace is in the lockfile.
2. **Build** — `pnpm --filter @mediapulse/env build`.
3. **Env and API key** — Run:
   ```bash
   ./setup-agent-env.sh <agent-name>
   ```
   This runs `dev-bootstrap.sh` (so the agent gets `.env` and `.env.local` from `env.agents.<name>.example` with the correct PORT), then **gets or creates** `DOMAIN_INTEGRATION_API_KEY` (**domain_integration**) and sets it in the agent’s `.env.local`. Key creation is automatic when an existing key is found in another agent’s `.env.local` or in **`packages/mediapulse/env/.env`**, or when `ADMIN_EMAIL` is set in **`packages/mediapulse/env/.env`**. If no key exists and no `ADMIN_EMAIL` is available, the script exits with instructions; then run again with `--admin-email <email>` or after `./dev-setup-local.sh`.
4. **Optional args for `setup-agent-env.sh`** — `--no-bootstrap` (skip bootstrap if .env already set up), `--admin-email EMAIL` (use when creating a new key and not in env), `--key-name NAME` (name for the new API key).

## After generation: what to customize

1. **Input and config** — In `src/index.ts`, replace or extend the Zod `InputSchema` and add `configSchema` on `createAgentApp` if the agent has config.
2. **Run logic** — Implement `run`; it receives `{ input, config, token }` and returns `Promise<AgentRunResult>` (e.g. `{ success: true }` or `{ success: false, message: "…" }`).

## Reference

- Minimal template: **ticker-echo** — `apps/mediapulse/agents/ticker-echo/src/index.ts`.
- Generator config: `turbo/generators/config.ts`; templates: `turbo/generators/templates/agent/`.
- Env setup: `./setup-agent-env.sh <agent-name>` — bootstrap + get/create `DOMAIN_INTEGRATION_API_KEY` (domain_integration).
- Dev-docs: [Generate a new agent](/mediapulse/apps/agents/generate-agent) in the docs site.
