/**
 * Hermes worker: long-running process that runs the DataQueue processor and supervisor
 * for the Hermes scheduler (check_schedules cron job). Run this app on a persistent server;
 * Hermes (Next.js) stays stateless and does not run the queue.
 */

const DRAIN_TIMEOUT_MS = 30_000;

async function main(): Promise<void> {
  const { getJobQueue } = await import("./queue");
  const { jobHandlers } = await import("./job-handlers");
  const { logger } = await import("@workspace/logger");

  let jobQueue: Awaited<ReturnType<typeof getJobQueue>> | null = null;
  let processor: {
    startInBackground: () => void;
    stopAndDrain: (ms?: number) => Promise<void>;
  } | null = null;
  let supervisor: {
    startInBackground: () => void;
    stopAndDrain: (ms?: number) => Promise<void>;
  } | null = null;

  try {
    jobQueue = getJobQueue();
  } catch (err) {
    logger.warn(
      { err },
      "Scheduler disabled: PG_DATAQUEUE_DATABASE not set. Set it and run pnpm run migrate-dataqueue to enable.",
    );
    process.exit(1);
  }

  const existingCron = await jobQueue
    .getCronJobByName("hermes-check-schedules")
    .catch(() => null);
  if (!existingCron) {
    await jobQueue.addCronJob({
      scheduleName: "hermes-check-schedules",
      cronExpression: "* * * * *",
      jobType: "check_schedules",
      payload: {},
      timezone: "UTC",
    });
  }

  processor = jobQueue.createProcessor(jobHandlers, {
    workerId: `hermes-${process.pid}`,
    batchSize: 10,
    concurrency: 3,
    pollInterval: 5000,
    onError: (err) => {
      logger.error({ err }, "DataQueue processor error");
    },
  });
  processor.startInBackground();

  supervisor = jobQueue.createSupervisor({
    intervalMs: 60_000,
    stuckJobsTimeoutMinutes: 10,
    cleanupJobsDaysToKeep: 30,
    cleanupEventsDaysToKeep: 30,
    onError: (err) => {
      logger.error({ err }, "DataQueue supervisor error");
    },
  });
  supervisor.startInBackground();

  const shutdown = async (): Promise<void> => {
    if (processor || supervisor) {
      await Promise.all([
        processor?.stopAndDrain(DRAIN_TIMEOUT_MS),
        supervisor?.stopAndDrain(DRAIN_TIMEOUT_MS),
      ]);
      processor = null;
      supervisor = null;
    }
    if (jobQueue?.getPool?.()) {
      jobQueue.getPool().end?.();
    }
  };

  process.on("SIGTERM", () => {
    shutdown().then(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    shutdown().then(() => process.exit(0));
  });

  logger.info("Hermes worker started (processor + supervisor)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
