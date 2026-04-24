/**
 * Best-effort in-process abort handles for manual pipeline runs. Only affects `got.post`
 * when cancel is invoked on the same Node process as the run.
 */
const abortControllers = new Map<string, AbortController>();

/**
 * Registers an {@link AbortController} for a manual execution and returns its signal for HTTP.
 */
export const registerManualPipelineRunAbortController = (
  manualExecutionId: string,
): AbortSignal => {
  const existing = abortControllers.get(manualExecutionId);
  if (existing) {
    return existing.signal;
  }
  const ac = new AbortController();
  abortControllers.set(manualExecutionId, ac);
  return ac.signal;
};

/**
 * Aborts an in-flight manual run HTTP request when the controller was registered locally.
 */
export const abortManualPipelineRunIfLocal = (
  manualExecutionId: string,
): void => {
  abortControllers.get(manualExecutionId)?.abort();
};

/**
 * Removes the abort controller when the run finishes or errors.
 */
export const clearManualPipelineRunAbortController = (
  manualExecutionId: string,
): void => {
  abortControllers.delete(manualExecutionId);
};

type ManualExecutionCancelPollDb = {
  manualPipelineExecution: {
    findUnique: (args: {
      where: { id: string };
      select: { cancelledAt: true };
    }) => Promise<{ cancelledAt: Date | null } | null>;
  };
};

const DEFAULT_CANCEL_POLL_MS = 400;

/**
 * Polls Postgres for `cancelledAt` on this execution and aborts the in-process HTTP signal when
 * set. Needed when cancel is handled on another instance (in-memory abort is a no-op there) or
 * while a long `got.post` is in flight (the invoke loop only checked between jobs before).
 *
 * Call the returned stopper from the same `finally` that clears the abort controller.
 */
export const startManualExecutionCancelledPollFromDb = (
  db: ManualExecutionCancelPollDb,
  manualExecutionId: string,
  intervalMs: number = DEFAULT_CANCEL_POLL_MS,
): (() => void) => {
  const tick = async () => {
    try {
      const row = await db.manualPipelineExecution.findUnique({
        where: { id: manualExecutionId },
        select: { cancelledAt: true },
      });
      if (row?.cancelledAt) {
        abortManualPipelineRunIfLocal(manualExecutionId);
      }
    } catch {
      // ignore transient read errors; next tick retries
    }
  };

  void tick();
  const handle = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => {
    clearInterval(handle);
  };
};
