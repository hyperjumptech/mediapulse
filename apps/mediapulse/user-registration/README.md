## Running development server

Run `pnpm dev:user-registration` from the root of the monorepo (or `pnpm dev` from `apps/user-registration`). Listens on port **3002**.

The home page loads tickers from **agent-data-api** on the server via **`GET /api/v1/user-registration-tickers`** (no token). Set **`AGENT_DATA_API_URL`** (see `packages/mediapulse/env/env.app.user-registration.example`).

## Installing shadcn/ui component

From the `apps/user-registration` directory, run

```bash
pnpm dlx shadcn@latest add [component]
```
