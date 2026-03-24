"use server";

import { getHttpTriggerById } from "@/lib/http-triggers";

export type HttpTriggerForEdit = {
  id: string;
  name: string;
  description: string | null;
  pipelineId: string;
  enabled: boolean;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  tokenHint: string | null;
};

/**
 * Fetches an HTTP trigger for edit modal prefill.
 */
export const getHttpTriggerForEdit = async (
  httpTriggerId: string,
): Promise<HttpTriggerForEdit | null> => {
  const row = await getHttpTriggerById(httpTriggerId);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    pipelineId: row.pipelineId,
    enabled: row.enabled,
    method: row.method,
    tokenHint: row.tokenHint,
  };
};
