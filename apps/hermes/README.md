## Running development server

Run `pnpm dev --filter hermes` from the root of the monorepo (or `pnpm dev` from `apps/hermes`). Hermes listens on port 3001.

## Dashboard

The Hermes dashboard (`/dashboard`) provides CRUD for **Pipelines**, **Tickers**, **Agents**, and **Schedules**. Use the sidebar to open each section. Schedules define when and how a pipeline runs (once or repeating, with cron or interval).

## Scheduler (DataQueue)

Schedules are stored in the database (`Schedule` table). A DataQueue cron job runs every minute and executes due schedules (expand params, invoke pipeline steps via HTTP).

**To enable the scheduler:**

1. Set `PG_DATAQUEUE_DATABASE` in `.env` or `.env.local` (e.g. same as `DATABASE_URL` with `?schema=dataqueue`).
2. Run DataQueue migrations: `pnpm run migrate-dataqueue` (from repo root or `apps/hermes`).
3. Ensure Prisma migrations are applied (including `Schedule`, `ScheduleExecution`, `AgentJobExecution`).
4. (Optional) Seed a default daily schedule: `pnpm exec tsx scripts/seed-default-schedule.ts` from `apps/hermes`.

## Creating an admin user

Run `pnpm dlx tsx scripts/create-admin.ts <email> <password>` from the `apps/hermes` directory.
Example:

```bash
pnpm dlx tsx scripts/create-admin.ts kevin@hyperjump.tech password123
```

## Installing shadcn/ui component

From the `apps/web` directory, run

```bash
pnpm dlx shadcn@latest add [component]
```
