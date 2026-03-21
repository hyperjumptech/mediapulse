/**
 * Pure pipeline status helpers for UI and schedule rules. No server/database imports.
 */

export type PipelineValidationResult = {
  valid: boolean;
  warnings: string[];
};

/** Pipeline status: incomplete (validation failed), disabled (isActive false), or enabled. */
export type PipelineStatus = "incomplete" | "disabled" | "enabled";

type PipelineWithIsActive = { id: string; isActive: boolean };

/**
 * Derives pipeline status from validation result and isActive flag.
 * Incomplete takes precedence over disabled; enabled requires both valid and isActive.
 *
 * @param pipeline - Pipeline with at least id and isActive.
 * @param validation - Result from validatePipeline for this pipeline.
 * @returns "incomplete" | "disabled" | "enabled".
 */
export function getPipelineStatus(
  pipeline: PipelineWithIsActive,
  validation: PipelineValidationResult,
): PipelineStatus {
  if (!validation.valid) return "incomplete";
  if (!pipeline.isActive) return "disabled";
  return "enabled";
}

/**
 * Returns a map of pipeline id to status for use in UI (e.g. pipelines table, schedule form).
 *
 * @param pipelines - Pipelines with steps and isActive (e.g. from getPipelinesWithSteps).
 * @param validationById - Map from pipeline id to validation result (e.g. from getPipelinesValidationMap).
 * @returns Record of pipeline id to PipelineStatus.
 */
export function getPipelineStatusMap(
  pipelines: Array<{ id: string; isActive: boolean }>,
  validationById: Record<string, PipelineValidationResult>,
): Record<string, PipelineStatus> {
  return Object.fromEntries(
    pipelines.map((p) => [
      p.id,
      getPipelineStatus(
        p,
        validationById[p.id] ?? { valid: false, warnings: [] },
      ),
    ]),
  );
}
