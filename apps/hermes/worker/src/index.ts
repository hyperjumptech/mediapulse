/**
 * Hermes worker: long-running process that runs the DataQueue processor and supervisor
 * for the Hermes scheduler (check_schedules cron job). Run this app on a persistent server;
 * Hermes (Next.js) stays stateless and does not run the queue.
 */

import { writeFileSync } from "node:fs";
import { env } from "@hermes/env/hermes-worker";

const DRAIN_TIMEOUT_MS = 30_000;
/** Written every minute; Docker HEALTHCHECK reads recency to detect hangs. */
const HEARTBEAT_PATH = "/tmp/hermes-worker-heartbeat";
const HEARTBEAT_INTERVAL_MS = 60_000;
/** Logged every 5 minutes to surface memory growth early. */
const MEMORY_LOG_INTERVAL_MS = 5 * 60 * 1_000;

const dataPlaneConc = Math.max(
  1,
  Number.parseInt(env.PROCESSOR_CONCURRENCY ?? "3", 10) || 3,
);
const dataPlaneBatch = Math.max(
  dataPlaneConc,
  Number.parseInt(env.PROCESSOR_BATCH_SIZE ?? "10", 10) || 10,
);
const controlPlaneConc = Math.max(
  1,
  Number.parseInt(env.HERMES_CONTROL_PLANE_CONCURRENCY ?? "2", 10) || 2,
);
const controlPlaneBatch = Math.max(
  controlPlaneConc,
  Number.parseInt(env.HERMES_CONTROL_PLANE_BATCH_SIZE ?? "5", 10) || 5,
);
const groupConcurrency = dataPlaneConc;

// ─── Module-level shutdown hook ───────────────────────────────────────────────
// Set inside main() once the processor/supervisor are running.
// The global error handlers below reference this so they can drain gracefully
// even when the error fires outside the main() scope.
let _shutdown: (() => Promise<void>) | null = null;
let _fatalHandlerTriggered = false;

/**
 * Logs a fatal error and initiates a graceful shutdown, falling back to a
 * forced `process.exit(1)` if shutdown does not complete within 10 seconds.
 * Guards against being triggered twice (e.g. cascading unhandled rejections).
 *
 * @param label - Short label for the error category (e.g. "unhandledRejection").
 * @param err - The thrown value or rejection reason.
 */
const handleFatalError = (label: string, err: unknown): void => {
  if (_fatalHandlerTriggered) return;
  _fatalHandlerTriggered = true;

  // Use console.error because the structured logger may not yet be initialised.
  console.error(`[hermes-worker] ${label}:`, err);

  // Force-exit if graceful shutdown stalls.
  const forceExitTimer = setTimeout(() => {
    console.error(
      "[hermes-worker] Graceful shutdown timed out — force exiting",
    );
    process.exit(1);
  }, 10_000);
  // .unref() so this timer does not keep the event loop alive on its own.
  forceExitTimer.unref();

  if (_shutdown) {
    _shutdown()
      .catch((shutdownErr) => {
        console.error("[hermes-worker] Shutdown error:", shutdownErr);
      })
      .finally(() => process.exit(1));
  } else {
    process.exit(1);
  }
};

// Register before main() so errors during startup are also caught.
process.on("unhandledRejection", (reason) => {
  handleFatalError("unhandledRejection", reason);
});
process.on("uncaughtException", (err) => {
  handleFatalError("uncaughtException", err);
});

async function main(): Promise<void> {
  const { getJobQueue } = await import("./queue");
  const { jobHandlers } = await import("./job-handlers");
  const { logger } = await import("@workspace/logger");

  let jobQueue: Awaited<ReturnType<typeof getJobQueue>> | null = null;
  let controlPlaneProcessor: {
    startInBackground: () => void;
    stopAndDrain: (ms?: number) => Promise<void>;
  } | null = null;
  let dataPlaneProcessor: {
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

  const existingCleanupCron = await jobQueue
    .getCronJobByName("hermes-cleanup-orphaned-executions")
    .catch(() => null);
  if (!existingCleanupCron) {
    await jobQueue.addCronJob({
      scheduleName: "hermes-cleanup-orphaned-executions",
      cronExpression: "*/15 * * * *",
      jobType: "cleanup_orphaned_executions",
      payload: {},
      timezone: "UTC",
    });
  }

  const { prisma: orchestrationPrisma } =
    await import("@hermes/orchestration-database");
  const { runStartupReconciliation } = await import("./startup-reconciliation");
  await runStartupReconciliation({
    db: orchestrationPrisma,
    logger,
    graceMs: env.HERMES_SCHEDULE_RECOVERY_GRACE_MS ?? 900_000,
  });

  controlPlaneProcessor = jobQueue.createProcessor(jobHandlers, {
    verbose: env.NODE_ENV === "development",
    workerId: `hermes-ctrl-${process.pid}`,
    jobType: [
      "check_schedules",
      "execute_http_trigger",
      "cleanup_orphaned_executions",
    ],
    batchSize: controlPlaneBatch,
    concurrency: controlPlaneConc,
    pollInterval: 5000,
    onError: (err) => {
      logger.error({ err }, "DataQueue control-plane processor error");
    },
  });
  controlPlaneProcessor.startInBackground();

  dataPlaneProcessor = jobQueue.createProcessor(jobHandlers, {
    verbose: env.NODE_ENV === "development",
    workerId: `hermes-data-${process.pid}`,
    jobType: "invoke_agent",
    batchSize: dataPlaneBatch,
    concurrency: dataPlaneConc,
    ...(groupConcurrency !== undefined ? { groupConcurrency } : {}),
    pollInterval: 5000,
    onError: (err) => {
      logger.error({ err }, "DataQueue data-plane processor error");
    },
  });
  dataPlaneProcessor.startInBackground();

  supervisor = jobQueue.createSupervisor({
    verbose: env.NODE_ENV === "development",
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
    if (controlPlaneProcessor || dataPlaneProcessor || supervisor) {
      await Promise.all([
        controlPlaneProcessor?.stopAndDrain(DRAIN_TIMEOUT_MS),
        dataPlaneProcessor?.stopAndDrain(DRAIN_TIMEOUT_MS),
        supervisor?.stopAndDrain(DRAIN_TIMEOUT_MS),
      ]);
      controlPlaneProcessor = null;
      dataPlaneProcessor = null;
      supervisor = null;
    }
    if (jobQueue?.getPool?.()) {
      jobQueue.getPool().end?.();
    }
  };

  // Expose to the module-level fatal handler so it can drain gracefully.
  _shutdown = shutdown;

  const onShutdownSignal = async (): Promise<void> => {
    let exitCode = 0;
    try {
      await shutdown();
    } catch (err) {
      logger.error({ err }, "Shutdown failed (drain timeout or error)");
      exitCode = 1;
    }
    process.exit(exitCode);
  };
  process.on("SIGTERM", () => {
    void onShutdownSignal();
  });
  process.on("SIGINT", () => {
    void onShutdownSignal();
  });

  // ─── Memory monitoring ─────────────────────────────────────────────────────
  // Logs heap and RSS every 5 minutes so memory growth is visible in the logs
  // before the OS kills the process with SIGKILL (OOM). If RSS climbs steadily
  // across restarts, there is a memory leak that needs profiling.
  const memTimer = setInterval(() => {
    const mem = process.memoryUsage();
    logger.info(
      {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
        externalMb: Math.round(mem.external / 1024 / 1024),
      },
      "worker memory usage",
    );
  }, MEMORY_LOG_INTERVAL_MS);
  memTimer.unref();

  // ─── Heartbeat file ────────────────────────────────────────────────────────
  // Docker HEALTHCHECK (see Dockerfile) confirms the main loop is alive by
  // checking that this file was touched within the last 2 minutes. A hung
  // event loop will stop updating the file and Docker will mark the container
  // unhealthy, triggering a restart per the deployment restart policy.
  const writeHeartbeat = (): void => {
    try {
      writeFileSync(HEARTBEAT_PATH, Date.now().toString());
    } catch {
      // Best-effort — a single failed write should not crash the worker.
    }
  };
  writeHeartbeat();
  const heartbeatTimer = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();

  logger.info(
    {
      pid: process.pid,
      dataPlane: {
        concurrency: dataPlaneConc,
        batchSize: dataPlaneBatch,
        groupConcurrency,
      },
      controlPlane: {
        concurrency: controlPlaneConc,
        batchSize: controlPlaneBatch,
      },
    },
    "Hermes worker started (control-plane + data-plane processors + supervisor)",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
