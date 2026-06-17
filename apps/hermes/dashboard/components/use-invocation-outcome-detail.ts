import { useMemo } from "react";

import {
  parseStoredAgentResponse,
  type StoredAgentResponseEnvelope,
} from "@/lib/format-invocation-outcome-summary";

export type InvocationOutcomeDetailModel = {
  transportError: unknown | null;
  envelope: StoredAgentResponseEnvelope | null;
  runSummary: Record<string, unknown> | null;
  logs: StoredAgentResponseEnvelope["logs"];
};

/**
 * Normalizes transport error and agent response JSON for the invocation detail modal.
 *
 * @param transportError - Raw `AgentJobExecution.error`.
 * @param agentResponse - Raw `AgentJobExecution.agentResponse`.
 * @returns Parsed sections for presentation.
 */
export const buildInvocationOutcomeDetailModel = (
  transportError: unknown | null,
  agentResponse: unknown | null,
): InvocationOutcomeDetailModel => {
  const envelope = parseStoredAgentResponse(agentResponse);
  const summary = envelope?.details?.summary;
  const runSummary =
    summary !== null && typeof summary === "object"
      ? (summary as Record<string, unknown>)
      : null;

  return {
    transportError,
    envelope,
    runSummary,
    logs: envelope?.logs ?? [],
  };
};

/**
 * Hook wrapper for {@link buildInvocationOutcomeDetailModel} (keeps components free of parsing logic).
 *
 * @param transportError - Raw transport error JSON.
 * @param agentResponse - Raw agent response envelope.
 */
export const useInvocationOutcomeDetail = (
  transportError: unknown | null,
  agentResponse: unknown | null,
): InvocationOutcomeDetailModel => {
  return useMemo(
    () => buildInvocationOutcomeDetailModel(transportError, agentResponse),
    [transportError, agentResponse],
  );
};
