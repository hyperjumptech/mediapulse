---
name: env-variables
description: Add, update, or manage environment variables in this Next.js monorepo using T3 Env and env-to-t3. Use when the user asks to add an env variable, update env.example, generate env types, work with @workspace/env, or configure per-app environment variables.
---

# Environment Variables Workflow

## Adding a new environment variable

1. **Update `env.example`** in `packages/env/` (or a per-app file like `env.example.app1`).
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
# Default (uses env.example)
pnpm build --filter @workspace/env

# Per-app variant
npx env-to-t3 -i env.example.app1 -o src/env.app1.ts
```

3. **Import from `@workspace/env`**, never from `process.env`.

```typescript
import { env } from "@workspace/env";
// or per-app:
import { env } from "@workspace/env/env.app1";
```

4. **Share `.env` for local dev** — run `./dev-bootstrap.sh` from the repo root to symlink `packages/env/.env` into each app's `.env.local`.

## Per-app environment files

When an app needs a different set of variables:

1. Create `env.example.<app>` in `packages/env/`.
2. Add a build script in `packages/env/package.json`:

```json
{
  "exports": { "./env.<app>": "./src/env.<app>.ts" },
  "scripts": {
    "build:<app>": "npx env-to-t3 -i env.example.<app> -o src/env.<app>.ts"
  }
}
```

3. Import with `@workspace/env/env.<app>` in the target app.

## Ground rules

- Never read `process.env` directly — always use the typed env object.
- Sensitive credentials must **not** have the `NEXT_PUBLIC_` prefix.
- Every variable must be documented with a comment in `env.example`.
