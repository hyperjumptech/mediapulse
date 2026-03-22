import { z } from "zod";

/**
 * Versioned execution configuration for pipelines and schedules (merged at run time).
 * See schedule execution results PRD §5.2.
 */
export const ExecutionConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  stepRollupPolicy: z.enum(["strict", "tolerant"]).default("strict"),
  stepOrder: z.enum(["sequential", "parallel"]).default("sequential"),
  continueSequentialAfterPartial: z.boolean().default(false),
});

/** Parsed, validated execution configuration. */
export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

const DEFAULT_CONFIG: ExecutionConfig = {
  schemaVersion: 1,
  stepRollupPolicy: "strict",
  stepOrder: "sequential",
  continueSequentialAfterPartial: false,
};

/**
 * Deep-merges two plain JSON-like objects. Arrays are replaced by the override, not merged.
 *
 * @param pipelineDefaults - Base object (e.g. pipeline.executionConfig).
 * @param scheduleOverrides - Overrides (e.g. schedule.executionConfig).
 * @returns Merged effective configuration object (still needs validation).
 */
export const deepMergeExecutionConfigJson = (
  pipelineDefaults: Record<string, unknown> | null | undefined,
  scheduleOverrides: Record<string, unknown> | null | undefined,
): Record<string, unknown> => {
  const base =
    pipelineDefaults != null &&
    typeof pipelineDefaults === "object" &&
    !Array.isArray(pipelineDefaults)
      ? { ...pipelineDefaults }
      : {};
  const over =
    scheduleOverrides != null &&
    typeof scheduleOverrides === "object" &&
    !Array.isArray(scheduleOverrides)
      ? scheduleOverrides
      : {};
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(over)) {
    const v = over[key];
    const existing = out[key];
    if (
      v !== undefined &&
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      existing !== undefined &&
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      out[key] = deepMergeExecutionConfigJson(
        existing as Record<string, unknown>,
        v as Record<string, unknown>,
      );
    } else if (v !== undefined) {
      out[key] = v;
    }
  }
  return out;
};

/**
 * Parses merged JSON into a validated {@link ExecutionConfig}, applying PRD defaults for missing keys.
 *
 * @param merged - Result of {@link deepMergeExecutionConfigJson}.
 * @returns Validated config.
 */
export const parseEffectiveExecutionConfig = (
  merged: Record<string, unknown>,
): ExecutionConfig => {
  return ExecutionConfigSchema.parse({ ...DEFAULT_CONFIG, ...merged });
};

/**
 * Builds effective execution config from optional pipeline and schedule JSON columns.
 *
 * @param pipelineConfig - `Pipeline.executionConfig`.
 * @param scheduleConfig - `Schedule.executionConfig`.
 */
export const mergeExecutionConfig = (
  pipelineConfig: unknown,
  scheduleConfig: unknown,
): ExecutionConfig => {
  const merged = deepMergeExecutionConfigJson(
    pipelineConfig as Record<string, unknown> | null | undefined,
    scheduleConfig as Record<string, unknown> | null | undefined,
  );
  return parseEffectiveExecutionConfig(merged);
};
