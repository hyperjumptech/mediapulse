import type { HermesInvokeCorrelation } from "./types.js";

/**
 * HTTP header names set by `invokeAgentPost` in `@hermes/scheduler` for scheduled runs.
 */
export const HERMES_HEADER_SCHEDULE_ID = "X-Schedule-Id";

/** Hermes schedule execution row id (header name). */
export const HERMES_HEADER_SCHEDULE_EXECUTION_ID = "X-Schedule-Execution-Id";

/** Hermes pipeline step id (header name). */
export const HERMES_HEADER_PIPELINE_STEP_ID = "X-Pipeline-Step-Id";

/** Hermes agent job execution id (header name). */
export const HERMES_HEADER_JOB_ID = "X-Job-Id";

/**
 * Reads Hermes schedule / step / job correlation from HTTP headers (e.g. Hono `req.header` lookup).
 * Returns only keys with non-empty trimmed values, or `undefined` when none are present.
 *
 * @param getHeader - Returns a header value or undefined (case-insensitive lookup).
 * @returns Correlation object for `AgentRunContext.hermesCorrelation`, or `undefined` if no headers.
 */
export function hermesInvokeCorrelationFromGetHeader(
  getHeader: (name: string) => string | undefined,
): HermesInvokeCorrelation | undefined {
  const scheduleId = getHeader(HERMES_HEADER_SCHEDULE_ID)?.trim();
  const scheduleExecutionId = getHeader(
    HERMES_HEADER_SCHEDULE_EXECUTION_ID,
  )?.trim();
  const pipelineStepId = getHeader(HERMES_HEADER_PIPELINE_STEP_ID)?.trim();
  const agentJobId = getHeader(HERMES_HEADER_JOB_ID)?.trim();

  const correlation: HermesInvokeCorrelation = {
    ...(scheduleId ? { scheduleId } : {}),
    ...(scheduleExecutionId ? { scheduleExecutionId } : {}),
    ...(pipelineStepId ? { pipelineStepId } : {}),
    ...(agentJobId ? { agentJobId } : {}),
  };

  if (
    correlation.scheduleId === undefined &&
    correlation.scheduleExecutionId === undefined &&
    correlation.pipelineStepId === undefined &&
    correlation.agentJobId === undefined
  ) {
    return undefined;
  }
  return correlation;
}
