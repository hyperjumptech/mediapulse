import type { HttpTriggerExecutionDetail } from "./http-triggers";
import type { ManualPipelineExecutionDetail } from "./pipeline-executions";
import type { ScheduleExecutionDetail } from "./schedules";

export {
  isSensitiveJsonKey,
  maskSecretsInJson,
  maskSensitiveInlinePatternsInString,
  SECRET_MASK,
} from "./json-secret-mask";

import { maskSecretsInJson } from "./json-secret-mask";

type ExecutionDiagnostics = {
  errors: unknown;
  metadata: unknown | null;
};

type InvocationJsonPayload = {
  params: unknown;
  invocationConfig: unknown | null;
};

export const maskExecutionDiagnosticsForDisplay = <
  Execution extends ExecutionDiagnostics,
>(
  execution: Execution,
): Execution => ({
  ...execution,
  errors: maskSecretsInJson(execution.errors),
  metadata:
    execution.metadata == null ? null : maskSecretsInJson(execution.metadata),
});

export const maskInvocationPayloadForDisplay = <
  Invocation extends InvocationJsonPayload,
>(
  invocation: Invocation,
): Invocation => ({
  ...invocation,
  params: maskSecretsInJson(invocation.params),
  invocationConfig:
    invocation.invocationConfig == null
      ? null
      : maskSecretsInJson(invocation.invocationConfig),
});

export const maskExecutionSummaryForDisplay = <
  Summary extends { execution: ExecutionDiagnostics },
>(
  summary: Summary,
): Summary => ({
  ...summary,
  execution: maskExecutionDiagnosticsForDisplay(summary.execution),
});

/**
 * Returns a copy of schedule execution detail with invocation `params` and `invocationConfig`
 * redacted for safe display in the dashboard (never expose resolved secrets in HTML or JSON APIs).
 *
 * @param detail - Loaded execution detail from the database.
 */
export const maskScheduleExecutionDetailForDisplay = (
  detail: ScheduleExecutionDetail,
): ScheduleExecutionDetail => ({
  ...detail,
  execution: maskExecutionDiagnosticsForDisplay(detail.execution),
  invocations: detail.invocations.map(maskInvocationPayloadForDisplay),
});

/**
 * HTTP trigger execution detail with `errors`, `metadata`, and per-invocation JSON masked for display.
 */
export const maskHttpTriggerExecutionDetailForDisplay = (
  detail: HttpTriggerExecutionDetail,
): HttpTriggerExecutionDetail => ({
  ...detail,
  execution: maskExecutionDiagnosticsForDisplay(detail.execution),
  invocations: detail.invocations.map(maskInvocationPayloadForDisplay),
});

/**
 * Manual pipeline execution detail with `errors` and per-invocation JSON masked for display.
 */
export const maskManualPipelineExecutionDetailForDisplay = (
  detail: ManualPipelineExecutionDetail,
): ManualPipelineExecutionDetail => ({
  ...detail,
  execution: maskExecutionDiagnosticsForDisplay(detail.execution),
  invocations: detail.invocations.map(maskInvocationPayloadForDisplay),
});
