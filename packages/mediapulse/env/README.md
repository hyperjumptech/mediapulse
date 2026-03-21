# `@mediapulse/env`

Mediapulse domain environment (domain API, agent-data-api, user-registration, agents, mediapulse database). After changing any `env*.example` file here, run `pnpm build` in this package to regenerate the typed `env` objects.

## Usage

```ts
import { env } from "@mediapulse/env";
```

Agents use per-agent exports:

```ts
import { env } from "@mediapulse/env/agents-delivery";
```

## Agent-specific overrides (development)

Mediapulse agents under `apps/mediapulse/agents/*` share `packages/mediapulse/env/.env` for most variables but need **per-agent** values for `PORT`, `AGENT_PUBLIC_URL`, and optionally `AGENT_API_KEY` (scheduler key for auto-registration).

**How it works:**

- `./dev-bootstrap.sh` symlinks each agent’s `.env` to `packages/mediapulse/env/.env` and builds `.env.local` from `env.agents.<name>.example` via `merge-agent-env.sh`.
- Agent `pnpm dev` uses **dotenv-cli** with `.env.local` then `.env`.

**Scripts:**

- `merge-env-examples.sh` — merges `env.example` and all `env.*.example` into `packages/mediapulse/env/.env`. `env.agent-data-api.example` adds variables required by `@hermes/env` when agent-data-api loads `@hermes/orchestration-database` (align values with `packages/hermes/env/env.example`).
- `merge-agent-env.sh <example-file> <output-file>` — merges one agent example into an app’s `.env.local`, preserving existing values.
