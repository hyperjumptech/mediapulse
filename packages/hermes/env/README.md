# `@hermes/env`

Hermes orchestration environment (dashboard, worker, APIs). After changing `env.example` or `env.hermes-worker.example`, run `pnpm build` in this package to regenerate typed `env` modules.

## Scoped codegen (Docker / CI)

By default, `pnpm build` runs **both** codegen slices (`default` and `hermes.worker`). To regenerate only what an image needs, set **`HERMES_ENV_BUILD_TARGETS`** to a comma-separated list of those keys (for example `default` only, or `default,hermes.worker`). Use `all` or leave unset for both. Unknown keys fail the build. Hermes Dockerfiles that use Turbo set this before `pnpm exec turbo build`.
