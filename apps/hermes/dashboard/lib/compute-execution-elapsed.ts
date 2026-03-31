/** Terminal pipeline run statuses: wall duration is meaningful when job bounds exist. */
const TERMINAL_RUN_STATUSES = new Set(["succeeded", "partial", "failed"]);

export type PipelineWallElapsedResult =
  | { kind: "unknown" }
  | { kind: "final"; ms: number }
  | { kind: "in_progress"; ms: number };

export type JobElapsedDisplayResult =
  | { kind: "unknown" }
  | { kind: "final"; ms: number }
  | { kind: "in_progress"; ms: number };

/**
 * Formats a non-negative duration in milliseconds for admin UI (compact, tabular-friendly).
 *
 * @param ms - Elapsed milliseconds (must be >= 0).
 * @returns Human-readable string (e.g. seconds, minutes, hours).
 */
export const formatElapsedMs = (ms: number): string => {
  if (ms < 0) {
    return "0s";
  }
  if (ms < 1000) {
    return "<1s";
  }
  const secTotal = Math.floor(ms / 1000);
  if (secTotal < 60) {
    return `${secTotal}s`;
  }
  const minTotal = Math.floor(secTotal / 60);
  const sec = secTotal % 60;
  if (minTotal < 60) {
    return sec > 0 ? `${minTotal}m ${sec}s` : `${minTotal}m`;
  }
  const h = Math.floor(minTotal / 60);
  const min = minTotal % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
};

/**
 * Worker run time for one job when both start and completion timestamps exist.
 *
 * @param startedAt - When the worker started processing, if recorded.
 * @param completedAt - When the job finished, if recorded.
 * @returns Elapsed ms, or null if either timestamp is missing.
 */
export const computeJobElapsedMs = (
  startedAt: Date | null,
  completedAt: Date | null,
): number | null => {
  if (startedAt == null || completedAt == null) {
    return null;
  }
  const ms = completedAt.getTime() - startedAt.getTime();
  if (ms < 0) {
    return null;
  }
  return ms;
};

/**
 * Display string for one job row: finished duration, snapshot while running, or em dash.
 *
 * @param startedAt - Worker start time.
 * @param completedAt - Worker completion time.
 * @param now - Current time (injectable for tests).
 * @returns Final duration, in-progress snapshot, or unknown.
 */
export const computeJobElapsedDisplay = (
  startedAt: Date | null,
  completedAt: Date | null,
  now: Date = new Date(),
): JobElapsedDisplayResult => {
  const finalMs = computeJobElapsedMs(startedAt, completedAt);
  if (finalMs != null) {
    return { kind: "final", ms: finalMs };
  }
  if (startedAt != null && completedAt == null) {
    const ms = now.getTime() - startedAt.getTime();
    if (ms >= 0) {
      return { kind: "in_progress", ms };
    }
  }
  return { kind: "unknown" };
};

/**
 * Formats a job elapsed result for the invocations table.
 *
 * @param result - Output from {@link computeJobElapsedDisplay}.
 * @returns Plain text cell value.
 */
export const formatJobElapsedCell = (
  result: JobElapsedDisplayResult,
): string => {
  if (result.kind === "unknown") {
    return "—";
  }
  if (result.kind === "final") {
    return formatElapsedMs(result.ms);
  }
  return `${formatElapsedMs(result.ms)} (so far)`;
};

/**
 * Earliest meaningful start for a job: worker start, else enqueue time.
 *
 * @param enqueuedAt - When the job was enqueued (required).
 * @param startedAt - When processing started, if known.
 */
const effectiveJobStart = (enqueuedAt: Date, startedAt: Date | null): Date => {
  return startedAt ?? enqueuedAt;
};

/**
 * Wall-clock span across all jobs in one pipeline execution.
 *
 * - **Terminal runs** (`succeeded` | `partial` | `failed`): `min(startedAt ?? enqueuedAt)` to `max(completedAt)` when both bounds exist.
 * - **Pending / running:** snapshot from earliest start to `now` (updates on refresh).
 * - **No jobs or insufficient timestamps:** unknown.
 *
 * @param invocations - Agent job rows for this execution.
 * @param runStatus - Execution-level run status.
 * @param now - Current time for in-progress snapshots (injectable for tests).
 */
export const computePipelineWallElapsed = (
  invocations: Array<{
    enqueuedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  }>,
  runStatus: string,
  now: Date = new Date(),
): PipelineWallElapsedResult => {
  if (invocations.length === 0) {
    return { kind: "unknown" };
  }

  let minStart: number | null = null;
  let maxCompleted: number | null = null;
  for (const job of invocations) {
    const start = effectiveJobStart(job.enqueuedAt, job.startedAt);
    const t0 = start.getTime();
    if (minStart == null || t0 < minStart) {
      minStart = t0;
    }
    if (job.completedAt != null) {
      const tc = job.completedAt.getTime();
      if (maxCompleted == null || tc > maxCompleted) {
        maxCompleted = tc;
      }
    }
  }

  if (minStart == null) {
    return { kind: "unknown" };
  }

  const isTerminal = TERMINAL_RUN_STATUSES.has(runStatus);

  if (isTerminal) {
    if (maxCompleted != null && maxCompleted >= minStart) {
      return { kind: "final", ms: maxCompleted - minStart };
    }
    return { kind: "unknown" };
  }

  if (runStatus === "running" || runStatus === "pending") {
    const ms = now.getTime() - minStart;
    if (ms >= 0) {
      return { kind: "in_progress", ms };
    }
    return { kind: "unknown" };
  }

  return { kind: "unknown" };
};

/**
 * Single-line label for pipeline execution summary (detail page / list).
 *
 * @param result - Output from {@link computePipelineWallElapsed}.
 * @returns Display string for admins.
 */
export const formatPipelineElapsedLabel = (
  result: PipelineWallElapsedResult,
): string => {
  if (result.kind === "unknown") {
    return "—";
  }
  if (result.kind === "final") {
    return formatElapsedMs(result.ms);
  }
  return `In progress (${formatElapsedMs(result.ms)})`;
};
