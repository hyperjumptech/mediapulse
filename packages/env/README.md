# `env`

If you update the `env.example` file, you need to run `npm run build` from the directory of this package to generate the type-safe environment variables object.

## Usage

```ts
import { env } from "@workspace/env";

const dbUrl = env.DB_URL;
const fetchTimeoutMs = env.NEXT_PUBLIC_FETCH_TIMEOUT_MS;
```

## Agent-specific overrides (development)

During development, **agents** (e.g. `apps/agents/delivery`, `data-collection`, `content-generation`) share the same `packages/env/.env` for most variables but need **per-agent** values for:

- `PORT` — each agent listens on a different port (4001, 4002, 4003).
- `AGENT_PUBLIC_URL` — public URL where that agent is reachable (e.g. `http://localhost:4003` for delivery).
- `AGENT_REGISTRY_API_KEY` — optional; can differ per agent when registering with the registry.

**How it works:**

- `./dev-bootstrap.sh` symlinks each agent’s `.env` to `packages/env/.env` (shared).
- For each agent it runs `merge-agent-env.sh` to create or update that agent’s **`.env.local`** from the corresponding `env.agents.<name>.example` file. Existing values in `.env.local` are preserved.
- When you run an agent’s `pnpm dev`, **dotenv-cli** loads **`.env.local` first, then `.env`** (dotenv-cli uses “first file wins”, so agent-specific values from `.env.local` are kept and `.env` only fills in the rest). The dev script uses **`bun run --no-env-file`** so Bun does not auto-load `.env` (Bun would overwrite with the shared file).

**Scripts:**

- `merge-env-examples.sh` — merges `env.example` and all `env.*.example` into `packages/env/.env`.
- `merge-agent-env.sh <example-file> <output-file>` — merges one agent example (e.g. `env.agents.delivery.example`) into an app’s `.env.local`, preserving existing values.
