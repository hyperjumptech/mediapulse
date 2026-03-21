/**
 * One-off script to create a default Schedule that mirrors the previous hardcoded cron:
 * daily at 06:00 UTC, running the first active pipeline with params expanding all tickers.
 * Run from apps/hermes: pnpm exec tsx scripts/seed-default-schedule.ts
 */
import { prisma } from "@workspace/orchestration-database";
import { computeNextRunAt } from "@workspace/hermes-scheduler";

const CRON_DAILY_06_UTC = "0 6 * * *";
const DEFAULT_SCHEDULE_NAME = "Daily pipeline run (06:00 UTC)";

async function main() {
  const pipeline = await prisma.pipeline.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!pipeline) {
    console.warn(
      "No active pipeline found. Create a pipeline first, then run this script.",
    );
    process.exit(1);
  }

  const existing = await prisma.schedule.findFirst({
    where: { name: DEFAULT_SCHEDULE_NAME, pipelineId: pipeline.id },
  });
  if (existing) {
    console.log("Default schedule already exists:", existing.id);
    process.exit(0);
  }

  const nextRunAt = computeNextRunAt(
    {
      repeat: "repeating",
      cronExpression: CRON_DAILY_06_UTC,
      interval: null,
      timezone: "UTC",
      nextRunAt: null,
    },
    new Date(),
  );
  if (!nextRunAt) {
    console.error("Failed to compute next run time");
    process.exit(1);
  }

  const schedule = await prisma.schedule.create({
    data: {
      name: DEFAULT_SCHEDULE_NAME,
      description:
        "Runs all active pipelines for all tickers (replaces previous hardcoded cron).",
      repeat: "repeating",
      cronExpression: CRON_DAILY_06_UTC,
      timezone: "UTC",
      nextRunAt,
      pipelineId: pipeline.id,
      priority: 0,
      enabled: true,
    },
  });
  console.log(
    "Created default schedule:",
    schedule.id,
    "next run:",
    nextRunAt.toISOString(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
