"use server";

import { getDashboardSession } from "@/lib/auth-dashboard";
import {
  getPipelinesUsingVariableKey,
  type PipelineUsageSummary,
} from "@/lib/pipeline-usage";

/**
 * Loads pipeline usage for a variable key in the variables edit modal.
 *
 * @param variableKey - Variable key to search in pipeline step JSON.
 * @returns Usage rows or an empty list when unauthorized.
 */
export const getVariablePipelineUsage = async (
  variableKey: string,
): Promise<PipelineUsageSummary[]> => {
  const session = await getDashboardSession();
  if (!session) {
    return [];
  }
  return getPipelinesUsingVariableKey(variableKey);
};
