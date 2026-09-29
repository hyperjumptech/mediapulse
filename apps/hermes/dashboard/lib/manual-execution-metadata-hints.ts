import { parseHermesEnqueueCorrelationFromMetadata } from "@hermes/scheduler/enqueue-diagnostics-correlation";

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
