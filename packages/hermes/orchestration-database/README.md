# About

Prisma package for Hermes orchestration domain models (pipelines, schedules, executions, API keys, and worker metadata).

## Environment Variables

Minimal template: `packages/hermes/env/env.orchestration-database.example` (merged with other Hermes env examples by `merge-env-examples.sh`).

| Variable                     | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| `ORCHESTRATION_DATABASE_URL` | Optional direct URL for orchestration tables.         |
| `DATABASE_URL`               | Fallback URL when orchestration-specific URL is unset |
| `DATABASE_CERT_BASE64`       | Base64 CA cert for SSL connections                    |
