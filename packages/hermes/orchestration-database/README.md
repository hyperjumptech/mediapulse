# About

Prisma package for Hermes orchestration domain models (pipelines, schedules, executions, API keys, and worker metadata).

## Environment Variables

Minimal template: `packages/hermes/env/env.orchestration-database.example` (merged with other Hermes env examples by `merge-env-examples.sh`).

| Variable                     | Description                          |
| ---------------------------- | ------------------------------------ |
| `ORCHESTRATION_DATABASE_URL` | Direct URL for orchestration tables. |
| `DATABASE_CERT_BASE64`       | Base64 CA cert for SSL connections   |
