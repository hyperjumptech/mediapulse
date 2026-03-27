# `@hermes/env`

Hermes domain environment (dashboard, worker, agent APIs, orchestration DB). After changing `env.example` or `env.hermes-worker.example`, run `pnpm build` in this package to regenerate the typed `env` object.

## Usage

```ts
import { env } from "@hermes/env";

const dbUrl = env.ORCHESTRATION_DATABASE_URL;
```

**hermes-worker** uses a separate schema:

```ts
import { env } from "@hermes/env/hermes-worker";
```

## Local development

- `./dev-bootstrap.sh` merges examples into `packages/hermes/env/.env` and symlinks Hermes apps and `packages/hermes/*` to that file.
- `merge-env-examples.sh` — merges `env.example` and `env.*.example` in this directory into `.env`.
