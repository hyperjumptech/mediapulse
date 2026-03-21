---
name: env-variables
description: Add, update, or manage environment variables in this Next.js monorepo using T3 Env and env-to-t3. Use when the user asks to add an env variable, update env.example, generate env types, work with @hermes/env or @mediapulse/env, or configure per-app environment variables.
---

# Environment Variables Workflow

The monorepo has two env packages: **`packages/hermes/env`** (`@hermes/env`) for Hermes, and **`packages/mediapulse/env`** (`@mediapulse/env`) for Mediapulse and agents.

## Adding a new environment variable

1. **Update the correct `env.example`** (or `env.*.example`) under `packages/hermes/env/` or `packages/mediapulse/env/`.
   - Add a comment explaining the purpose and where to obtain the value.
   - Add `env-to-t3` annotations after the value.

```dotenv
# The access token for the Acme API. Get it from https://acme.com/settings/tokens
ACME_API_TOKEN=your-token-here #required
```

### Annotation reference

| Annotation  | Effect in generated T3 schema                                    |
| ----------- | ---------------------------------------------------------------- |
| `#required` | `z.string().min(1)` — validation fails if empty/missing          |
| `#number`   | `z.number({ coerce: true })` — coerces string to number          |
| `#default`  | `.default(VALUE).optional()` — uses the example value as default |

Combine annotations: `TIMEOUT=5000 #number #default` → `z.number({ coerce: true }).default(5000).optional()`.

2. **Regenerate the typed env object.**

```bash
pnpm build --filter @hermes/env
pnpm build --filter @mediapulse/env
```

3. **Import from `@hermes/env` or `@mediapulse/env`**, never from `process.env`.

```typescript
import { env } from "@hermes/env";
// or
import { env } from "@mediapulse/env";
// subpaths when defined, e.g.:
import { env } from "@hermes/env/hermes-worker";
import { env } from "@mediapulse/env/agents-delivery";
```

4. **Share `.env` for local dev** — run `./dev-bootstrap.sh` from the repo root to merge examples and symlink each app to the correct domain `packages/*/env/.env`.

## Ground rules

- Never read `process.env` directly — always use the typed env object.
- Sensitive credentials must **not** have the `NEXT_PUBLIC_` prefix.
- Every variable must be documented with a comment in the relevant `env*.example`.
