import { parseHermesEnqueueCorrelationFromMetadata } from "@hermes/scheduler/enqueue-diagnostics-correlation";

/**
 * Which Hermes execution detail page is rendering (drives invocation-transport copy).
 */
export type HermesExecutionDetailPageKind =
  | "manual-pipeline"
  | "schedule"
  | "http-trigger";

export type HermesExecutionInvokeTransportBlurb = {
  /** Short label for the summary grid. */
  headline: string;
  /** One or two sentences for operators (DataQueue vs dashboard HTTP). */
  detail: string;
};

/**
 * Explains how agent jobs are invoked for this execution type so operators do not
 * mis-attribute behaviour to DataQueue when using dashboard manual runs.
 */
export const getHermesExecutionInvokeTransportBlurb = (
  kind: HermesExecutionDetailPageKind,
): HermesExecutionInvokeTransportBlurb => {
  if (kind === "manual-pipeline") {
    return {
      headline: "Dashboard HTTP (no DataQueue)",
      detail:
        "Manual runs invoke agents with synchronous HTTP POSTs from the Hermes dashboard server. The Hermes worker and DataQueue are not used. A row can stay “running” for a long time while the dashboard waits for the agent HTTP response to finish.",
    };
  }
  if (kind === "schedule") {
    return {
      headline: "Hermes worker + DataQueue",
      detail:
        "Scheduled runs enqueue `invoke_agent` jobs on DataQueue. The worker POSTs to each agent using the schedule timeout (default five minutes unless the schedule overrides `timeout`).",
    };
  }
  return {
    headline: "Hermes worker + DataQueue",
    detail:
      "HTTP-triggered runs enqueue `invoke_agent` jobs on DataQueue, same as schedules. Inspect worker logs and DataQueue job state when invocations retry or stall.",
  };
};

/**
 * Optional sublines from masked manual execution metadata (`source`, correlation ids).
 */
export const formatManualExecutionMetadataHints = (
  metadata: unknown,
): string[] => {
  const root =
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : null;
  const lines: string[] = [];
  const source = root?.source;
  if (typeof source === "string" && source.trim() !== "") {
    lines.push(
      source === "dashboard"
        ? "Started from: Dashboard (Run pipeline)"
        : `Started from: ${source}`,
    );
  }
  const correlation = parseHermesEnqueueCorrelationFromMetadata(metadata);
  if (correlation?.requestId) {
    lines.push(`Request id: ${correlation.requestId}`);
  }
  return lines;
};
