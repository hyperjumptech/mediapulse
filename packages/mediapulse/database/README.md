# About

Prisma package for Mediapulse domain models (tickers, search queries, data sources, newsletters, and knowledge graph entities).

## Environment Variables

| Variable                  | Description                              |
| ------------------------- | ---------------------------------------- |
| `MEDIAPULSE_DATABASE_URL` | Direct URL for Mediapulse domain tables. |
| `DATABASE_CERT_BASE64`    | Base64 CA cert for SSL connections       |

## Knowledge graph vocabulary seed

From the monorepo root, with this package’s env configured (`packages/mediapulse/env/.env`):

`pnpm --filter @mediapulse/database run seed-kg-vocabulary`
