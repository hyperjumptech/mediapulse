## Running development server

Run `pnpm dev --filter hermes` from the root of the monorepo (or `pnpm dev` from `apps/hermes`). Hermes listens on port 3001.

## Dashboard

The Hermes dashboard (`/dashboard`) provides CRUD for **Pipelines**, **Tickers**, **Agents**, and **Schedules**. Use the sidebar to open each section. Schedules define when and how a pipeline runs (once or repeating, with cron or interval). Click a schedule name to open its **detail page** (`/dashboard/schedules/[id]`), where you can view a paginated list of executions (newest first), open error logs in a modal, and edit the schedule.

## Scheduler (DataQueue)

Schedules are stored in the database (`Schedule` table). The **scheduler does not run inside Hermes**. Run the **hermes-worker** app on a persistent server: it runs the DataQueue processor and supervisor (cron job every minute, execute due schedules). Hermes is a stateless Next.js app.

**To run the scheduler:**

1. Set `PG_DATAQUEUE_DATABASE` (e.g. same as `DATABASE_URL` with `?schema=dataqueue`). Run DataQueue migrations from **hermes-worker**: `pnpm --filter hermes-worker run migrate-dataqueue` (or from `apps/hermes-worker`: `pnpm run migrate-dataqueue`).
2. Ensure Prisma migrations are applied (including `Schedule`, `ScheduleExecution`, `AgentJobExecution`).
3. Start **hermes-worker** (e.g. `pnpm dev:hermes-worker` from repo root).
4. (Optional) Seed a default daily schedule: `pnpm exec tsx scripts/seed-default-schedule.ts` from `apps/hermes`.

## Knowledge graph seeding (development)

With Prisma migrations applied and `apps/hermes/.env.local` configured, you can seed default knowledge-graph data from this directory:

```bash
pnpm seed-kg-vocabulary
pnpm seed-kg-pipelines
```

The first command loads entity types and relation types; the second loads the default KG pipelines and their schedules. Both scripts are idempotent.

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
