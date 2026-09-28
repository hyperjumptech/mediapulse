const CANCELLABLE_RUN_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "running",
]);

export const isHermesExecutionCancellable = (runStatus: string): boolean =>
  CANCELLABLE_RUN_STATUSES.has(runStatus);
