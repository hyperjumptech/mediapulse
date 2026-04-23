/**
 * Canonical JSON for execution `metadata.hermesEnqueueCorrelation`.
 * Used by Hermes dashboard persistence and diagnostics UI.
 */

/** Key on `ScheduleExecution` / `HttpTriggerExecution` / `ManualPipelineExecution` `metadata` JSON. */
export const HERMES_ENQUEUE_CORRELATION_METADATA_KEY =
  "hermesEnqueueCorrelation";

export type HermesEnqueueCorrelation = {
  requestId?: string;
  workerTickId?: string;
};

const asPlainObject = (value: unknown): Record<string, unknown> | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

/**
 * Deep-merges `patch` into `metadata.hermesEnqueueCorrelation`, preserving all other metadata keys.
 *
 * @param existing - Current Prisma JSON metadata (may be null).
 * @param patch - Fields to set; omitted keys are left unchanged when already present.
 */
export const mergeHermesEnqueueCorrelationIntoMetadata = (
  existing: unknown,
  patch: Partial<HermesEnqueueCorrelation>,
): Record<string, unknown> => {
  const base = { ...asPlainObject(existing) };
  const prev = asPlainObject(base[HERMES_ENQUEUE_CORRELATION_METADATA_KEY]);
  const next: Record<string, unknown> = { ...(prev ?? {}) };
  if (patch.requestId !== undefined) {
    next.requestId = patch.requestId;
  }
  if (patch.workerTickId !== undefined) {
    next.workerTickId = patch.workerTickId;
  }
  base[HERMES_ENQUEUE_CORRELATION_METADATA_KEY] = next;
  return base;
};

/**
 * Returns correlation fields to show in the diagnostics panel, or `undefined` when absent/empty.
 */
export const parseHermesEnqueueCorrelationFromMetadata = (
  metadata: unknown,
): HermesEnqueueCorrelation | undefined => {
  const root = asPlainObject(metadata);
  if (root == null) return undefined;
  const raw = root[HERMES_ENQUEUE_CORRELATION_METADATA_KEY];
  const block = asPlainObject(raw);
  if (block == null) return undefined;

  const requestId =
    typeof block.requestId === "string" && block.requestId.trim() !== ""
      ? block.requestId.trim()
      : undefined;
  const workerTickId =
    typeof block.workerTickId === "string" && block.workerTickId.trim() !== ""
      ? block.workerTickId.trim()
      : undefined;

  if (requestId == null && workerTickId == null) return undefined;
  return {
    ...(requestId != null ? { requestId } : {}),
    ...(workerTickId != null ? { workerTickId } : {}),
  };
};
