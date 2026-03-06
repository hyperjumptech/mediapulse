/**
 * Node.js-only instrumentation: queue processor, supervisor, and signal handlers.
 * Loaded only when NEXT_RUNTIME === "nodejs" so it can use process.on, process.pid, etc.
 */

const DRAIN_TIMEOUT_MS = 30_000;

export async function runNodeInstrumentation(): Promise<void> {
  const { getJobQueue } = await import("./lib/queue");
  const { jobHandlers } = await import("./lib/job-handlers");
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
    return;
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

  const shutdown = async () => {
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
}
