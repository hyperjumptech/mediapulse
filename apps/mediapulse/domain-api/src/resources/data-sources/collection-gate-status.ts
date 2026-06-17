import type { CollectionGateStatus } from "@mediapulse/database";
import { z } from "zod";

/** List-filter values for global page-collection gate status. */
export const collectionGateStatusFilterSchema = z.enum(["passed", "failed"]);

export type CollectionGateStatusFilter = z.infer<
  typeof collectionGateStatusFilterSchema
>;

export const COLLECTION_GATE_STATUS_LABEL: Record<
  CollectionGateStatusFilter,
  string
> = {
  passed: "Passed",
  failed: "Failed",
};

/** Dropdown options for the Hermes `collectionGateStatus` list filter (from GET meta). */
export const COLLECTION_GATE_STATUS_OPTIONS = (
  Object.entries(COLLECTION_GATE_STATUS_LABEL) as Array<
    [CollectionGateStatusFilter, string]
  >
).map(([value, label]) => ({ value, label }));

/**
 * Maps a stored gate status enum to a human-readable label for detail views.
 *
 * @param status - Nullable `collectionGateStatus` from `DataSource`.
 * @returns Label string or empty when unset.
 */
export const formatCollectionGateStatusLabel = (
  status: CollectionGateStatus | null,
): string => {
  if (status === null) {
    return "";
  }
  return COLLECTION_GATE_STATUS_LABEL[status];
};
