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
