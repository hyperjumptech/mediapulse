"use server";

import {
  getPipelinesUsingVariableKey,
  type PipelineUsageSummary,
} from "@/lib/pipeline-usage";
import { getDashboardAdmin } from "@/lib/require-dashboard-admin";

/**
 * Loads pipeline usage for a variable key in the variables edit modal.
 *
 * @param variableKey - Variable key to search in step JSON, saved agent config JSON, and pipeline execution config.
 * @returns Usage rows or an empty list when unauthorized.
 */
export const getVariablePipelineUsage = async (
  variableKey: string,
): Promise<PipelineUsageSummary[]> => {
  const admin = await getDashboardAdmin();
  if (!admin) {
    return [];
  }

  return getPipelinesUsingVariableKey(variableKey);
};
