import type { ExecutionConfig } from "./execution-config";

/** Terminal rollup for one pipeline step within an execution. */
export type StepRollupTerminal = "success" | "partial" | "failed";

/**
 * Computes step rollup from invocation counts once all invocations for the step are terminal (PRD §6.2).
 *
 * @param succeededCount - Completed (semantic success) invocations.
 * @param failedCount - Failed invocations (transport or semantic).
 * @param policy - From effective execution config.
 */
export const computeStepRollupFromCounts = (
  succeededCount: number,
  failedCount: number,
  policy: ExecutionConfig["stepRollupPolicy"],
): StepRollupTerminal => {
  const total = succeededCount + failedCount;
  if (total === 0) {
    return "failed";
  }
  if (policy === "strict") {
    return failedCount > 0 ? "failed" : "success";
  }
  if (failedCount === 0) {
    return "success";
  }
  if (succeededCount === 0) {
    return "failed";
  }
  return "partial";
};

/**
 * Computes schedule execution `runStatus` from per-step terminal rollups (PRD §6.3 FR-EXE-3).
 *
 * @param stepRollups - One entry per step execution row (only steps that had invocations).
 * @param policy - Step rollup policy from effective config.
 */
export const computeExecutionRunStatusFromStepRollups = (
  stepRollups: StepRollupTerminal[],
  policy: ExecutionConfig["stepRollupPolicy"],
): "succeeded" | "partial" | "failed" => {
  if (stepRollups.length === 0) {
    return "failed";
  }
  if (stepRollups.some((s) => s === "failed")) {
    return "failed";
  }
  if (policy === "strict") {
    return stepRollups.every((s) => s === "success") ? "succeeded" : "failed";
  }
  if (stepRollups.some((s) => s === "partial")) {
    return "partial";
  }
  return "succeeded";
};
