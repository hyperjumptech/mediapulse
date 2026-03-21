/**
 * One-time backfill: for every pipeline, if it is not enabled (inactive or
 * validation invalid), disables all schedules that reference it so
 * hermes-scheduler will not run them.
 *
 * Run from repo root: pnpm --filter @hermes/dashboard exec tsx scripts/backfill-disable-schedules-for-invalid-pipelines.ts
 * Or from apps/hermes: pnpm exec tsx scripts/backfill-disable-schedules-for-invalid-pipelines.ts
 */
import { prisma } from "@hermes/orchestration-database";
import { getPipelinesWithSteps } from "../lib/pipelines";
import { disableSchedulesForPipelineIfNotEnabled } from "../lib/disable-schedules-for-pipeline";

async function main() {
  const pipelines = await getPipelinesWithSteps(prisma);
  for (const pipeline of pipelines) {
    await disableSchedulesForPipelineIfNotEnabled(prisma, pipeline.id);
  }
  console.log(
    `Processed ${pipelines.length} pipeline(s). Schedules referencing non-enabled pipelines have been disabled.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
