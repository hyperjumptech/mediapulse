import type { HermesInvokeCorrelation } from "./types.js";

/**
 * HTTP header names set by `invokeAgentPost` in `@hermes/scheduler` for scheduled runs.
 */
export const HERMES_HEADER_SCHEDULE_ID = "X-Schedule-Id";

/** Hermes schedule execution row id (header name). */
export const HERMES_HEADER_SCHEDULE_EXECUTION_ID = "X-Schedule-Execution-Id";

/** Hermes pipeline step id (header name). */
export const HERMES_HEADER_PIPELINE_STEP_ID = "X-Pipeline-Step-Id";

/** Hermes agent job id (header name); sent by `invokeAgentPost`. */
export const HERMES_HEADER_JOB_ID = "X-Job-Id";

/** Hermes execution id (header name); sent by `invokeAgentPost`. */
export const HERMES_HEADER_EXECUTION_ID = "X-Execution-Id";

/**
 * Reads Hermes job / execution / schedule / step correlation from HTTP headers (e.g. Hono `req.header` lookup).
 * Returns only keys with non-empty trimmed values, or `undefined` when none are present.
 *
 * @param getHeader - Returns a header value or undefined (case-insensitive lookup).
 * @returns Correlation object for `AgentRunContext.hermesCorrelation`, or `undefined` if no headers.
 */
export function hermesInvokeCorrelationFromGetHeader(
  getHeader: (name: string) => string | undefined,
): HermesInvokeCorrelation | undefined {
  const jobId = getHeader(HERMES_HEADER_JOB_ID)?.trim();
  const executionId = getHeader(HERMES_HEADER_EXECUTION_ID)?.trim();
  const scheduleId = getHeader(HERMES_HEADER_SCHEDULE_ID)?.trim();
  const scheduleExecutionId = getHeader(
    HERMES_HEADER_SCHEDULE_EXECUTION_ID,
  )?.trim();
  const pipelineStepId = getHeader(HERMES_HEADER_PIPELINE_STEP_ID)?.trim();
  const correlation: HermesInvokeCorrelation = {
    ...(jobId ? { jobId } : {}),
    ...(executionId ? { executionId } : {}),
    ...(scheduleId ? { scheduleId } : {}),
    ...(scheduleExecutionId ? { scheduleExecutionId } : {}),
    ...(pipelineStepId ? { pipelineStepId } : {}),
  };
  if (
    correlation.jobId === undefined &&
    correlation.executionId === undefined &&
    correlation.scheduleId === undefined &&
    correlation.scheduleExecutionId === undefined &&
    correlation.pipelineStepId === undefined
  ) {
    return undefined;
  }
  return correlation;
}
