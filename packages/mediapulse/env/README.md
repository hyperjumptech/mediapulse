# `@mediapulse/env`

Mediapulse domain environment (domain API, agent-data-api, user-registration, agents, mediapulse database). After changing any `env*.example` file here, run `pnpm build` in this package to regenerate the typed `env` objects.

## Scoped codegen (Docker / CI)

By default, `pnpm build` runs **every** `env-to-t3` slice (all agents + apps). For faster Fly image builds, set **`MEDIAPULSE_ENV_BUILD_TARGETS`** to a comma-separated subset of keys (same names as the `build:*` scripts without the `build:` prefix), for example `agents.delivery` or `default,app.user-registration`. Use `all` or leave unset for the full set. Unknown keys fail the build. Mediapulse Dockerfiles in this repo set this variable before `turbo build`.

## Usage

```ts
import { env } from "@mediapulse/env";
```

Agents use per-agent exports:

```ts
import { env } from "@mediapulse/env/agents-delivery";
```

The **user-registration Next.js app** (public form on port 3002) uses a slim export so SSR does not validate agent-only secrets:

```ts
import { env } from "@mediapulse/env/app-user-registration";
```

## Agent-specific overrides (development)

Mediapulse agents under `apps/mediapulse/agents/*` share `packages/mediapulse/env/.env` for most variables but need **per-agent** values for `PORT`, `AGENT_PUBLIC_URL`, and `DOMAIN_INTEGRATION_API_KEY` (Hermes **domain integration API key** for auto-registration JWT minting).

**How it works:**

- `./dev-bootstrap.sh` symlinks each agent’s `.env` to `packages/mediapulse/env/.env` and builds `.env.local` from `env.agents.<name>.example` via `merge-agent-env.sh`.
- Agent `pnpm dev` uses **dotenv-cli** with `.env.local` then `.env`.

**Scripts:**

- `merge-env-examples.sh` — merges `env.example` and all `env.*.example` into `packages/mediapulse/env/.env`. `env.agent-data-api.example` adds variables required by `@hermes/env` when agent-data-api loads `@hermes/orchestration-database` (align values with `packages/hermes/env/env.example`).
- `merge-agent-env.sh <example-file> <output-file>` — merges one agent example into an app’s `.env.local`, preserving existing values.
