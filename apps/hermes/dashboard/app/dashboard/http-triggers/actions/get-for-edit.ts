"use server";

import { getHttpTriggerById } from "@/lib/http-triggers";
import { requireDashboardAdmin } from "@/lib/require-dashboard-admin";

export type HttpTriggerForEdit = {
  id: string;
  name: string;
  description: string | null;
  pipelineId: string;
  enabled: boolean;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  tokenHint: string | null;
  authType: "BEARER_TOKEN" | "DOMAIN_EVENT";
  eventName: string | null;
};

/**
 * Fetches an HTTP trigger for edit modal prefill.
 */
export const getHttpTriggerForEdit = async (
  httpTriggerId: string,
): Promise<HttpTriggerForEdit | null> => {
  await requireDashboardAdmin();
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
    authType: row.authType,
    eventName: row.eventName,
  };
};
