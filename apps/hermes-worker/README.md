# hermes-worker

Long-running Node/Bun process that runs the **DataQueue** processor and supervisor for the Hermes scheduler. The cron job `hermes-check-schedules` runs every minute and enqueues `check_schedules` jobs; this worker processes those jobs (polls due schedules, then enqueues one **invoke_agent_step** job per expanded input set so execution is controlled and the agent server is not overwhelmed).

- **Hermes** (Next.js) no longer runs the queue; run this app on a persistent server for scheduled runs.
- **Env:** `PG_DATAQUEUE_DATABASE` required; `DATABASE_URL` and `AGENT_API_KEY` for schedule execution.
- **Migrations:** Run `pnpm run migrate-dataqueue` (or `migrate-dataqueue:dev`) from this app before starting the worker. Also run Prisma migrations for the main DB (adds `scheduleExecutionId` on `AgentJobExecution` and `enqueuing` schedule execution status).

## Scripts

- `pnpm dev` — Start worker with hot reload (Bun).
- `pnpm build` / `pnpm start` — Build and run production build.
- `pnpm run migrate-dataqueue` — Run DataQueue schema migrations.
- `pnpm run migrate-dataqueue:dev` — Same with dev env and verbose output.

## From repo root

- `pnpm dev:hermes-worker` — Run the worker in development.
- DataQueue migrations can be run from this app: `pnpm --filter hermes-worker run migrate-dataqueue`.
