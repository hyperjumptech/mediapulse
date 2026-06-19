import { formatInvocationErrorSummary } from "./format-invocation-error";

/** Parsed agent response envelope stored on `AgentJobExecution.agentResponse`. */
export type StoredAgentResponseEnvelope = {
  schemaVersion?: number;
  status?: "success" | "failure";
  message?: string;
  details?: Record<string, unknown>;
  logs?: Array<{
    level: string;
    message: string;
    context?: Record<string, unknown>;
  }>;
};

type RunSummary = {
  status?: string;
  totalSources?: number;
  discoveredCount?: number;
  fetchSuccess?: number;
  fetchFailed?: number;
  droppedByContentQuality?: Record<string, number>;
  droppedByDeadUrlCache?: number;
  droppedByFetchBudget?: number;
  droppedByExistingCanonicalUrl?: number;
  droppedByDuplicateCanonicalUrl?: number;
  droppedByUrlNoise?: number;
  droppedByHostErrorRate?: number;
  droppedByRunItemCap?: number;
  deadlineHit?: boolean;
};

/**
 * Returns true when the value looks like a stored Hermes agent response envelope.
 *
 * @param value - Raw JSON from `AgentJobExecution.agentResponse`.
 */
export const isStoredAgentResponseEnvelope = (
  value: unknown,
): value is StoredAgentResponseEnvelope => {
  return (
    value !== null &&
    typeof value === "object" &&
    ("status" in value || "message" in value || "details" in value)
  );
};

/**
 * Parses `agentResponse` JSON into a normalized envelope shape.
 *
 * @param agentResponse - Raw stored value.
 * @returns Parsed envelope or null when not recognizable.
 */
export const parseStoredAgentResponse = (
  agentResponse: unknown,
): StoredAgentResponseEnvelope | null => {
  if (!isStoredAgentResponseEnvelope(agentResponse)) {
    return null;
  }
  return agentResponse;
};

const sumQualityDrops = (
  droppedByContentQuality: Record<string, number> | undefined,
): number => {
  if (!droppedByContentQuality) {
    return 0;
  }
  return Object.values(droppedByContentQuality).reduce(
    (sum, count) => sum + count,
    0,
  );
};

/**
 * Builds a warning summary for successful invocations with non-fatal run issues.
 *
 * @param summary - `details.summary` from collection agents.
 * @returns Human-readable warning or null when nothing notable.
 */
export const formatRunSummaryWarning = (
  summary: RunSummary | undefined,
): string | null => {
  if (!summary) {
    return null;
  }

  const parts: string[] = [];
  const fetchFailed = summary.fetchFailed ?? 0;
  const qualityDrops = sumQualityDrops(summary.droppedByContentQuality);
  const persisted = summary.totalSources ?? 0;
  const discovered = summary.discoveredCount ?? 0;

  if (summary.status === "partial_success") {
    parts.push("Partial success");
  }

  if (fetchFailed > 0) {
    parts.push(`${fetchFailed} fetch failure${fetchFailed === 1 ? "" : "s"}`);
  }

  if (qualityDrops > 0) {
    parts.push(
      `${qualityDrops} content quality drop${qualityDrops === 1 ? "" : "s"}`,
    );
  }

  if (summary.deadlineHit) {
    parts.push("deadline hit");
  }

  if (discovered === 0 && persisted === 0 && parts.length === 0) {
    return "0 sources discovered";
  }

  if (parts.length === 0) {
    return null;
  }

  const persistedPart =
    persisted > 0
      ? `, ${persisted} persisted`
      : persisted === 0
        ? ", 0 persisted"
        : "";

  return `${parts.join(", ")}${persistedPart}`;
};

/**
 * Returns a single-line outcome summary for the invocations Reason column by merging
 * transport errors, semantic agent messages, and run warnings.
 *
 * @param error - Transport/HTTP error JSON from `AgentJobExecution.error`.
 * @param agentResponse - Parsed agent envelope from `AgentJobExecution.agentResponse`.
 */
export const formatInvocationOutcomeSummary = (
  error: unknown,
  agentResponse: unknown,
): string | null => {
  const transportSummary = formatInvocationErrorSummary(error);
  if (transportSummary) {
    return transportSummary;
  }

  const envelope = parseStoredAgentResponse(agentResponse);
  if (!envelope) {
    return null;
  }

  if (typeof envelope.message === "string" && envelope.message.length > 0) {
    return envelope.message;
  }

  const failureReason = envelope.details?.failureReason;
  if (typeof failureReason === "string" && failureReason.length > 0) {
    return failureReason;
  }

  const summary = envelope.details?.summary;
  if (summary && typeof summary === "object") {
    return formatRunSummaryWarning(summary as RunSummary);
  }

  return null;
};
