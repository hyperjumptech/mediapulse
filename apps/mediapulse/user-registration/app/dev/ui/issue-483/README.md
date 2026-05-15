# Dev fixture: full registration + Hyperjump attribution

**Route:** `/dev/ui/issue-483` (see [`page.tsx`](./page.tsx)) — only when `NODE_ENV` is `development`; otherwise **404**.

Renders the same shell as production `/`: **RegistrationForm** with fixture tickers (no agent-data-api) plus **HyperjumpProductAttribution**.

**Ticket:** https://github.com/hyperjumptech/mediapulse/issues/483

## Run locally

From the monorepo root:

```bash
pnpm dev:user-registration
```

Open http://localhost:3002/dev/ui/issue-483

Set env vars per `packages/mediapulse/env/env.app.user-registration.example` (monorepo root paths; at minimum `NEXT_PUBLIC_REGISTRATION_EMAIL` and `AGENT_DATA_API_URL`).

## UI evidence (screenshots / video)

Store binaries under gitignored `artifacts/ui-evidence/issue-483/` or attach them to the PR / GitHub issue.

### Example: headless Chrome screenshot

From `apps/mediapulse/user-registration`, with env set as in the example file:

```bash
NEXT_PUBLIC_REGISTRATION_EMAIL=registration@mediapulse.example \
AGENT_DATA_API_URL=http://localhost:8081 \
NODE_ENV=development \
pnpm exec next dev --turbopack -p 3002
```

Then (adjust paths as needed):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --window-size=1280,2200 \
  --screenshot=artifacts/ui-evidence/issue-483/after.png \
  "http://127.0.0.1:3002/dev/ui/issue-483"
```
