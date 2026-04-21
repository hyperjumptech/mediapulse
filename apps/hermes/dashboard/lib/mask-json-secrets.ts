import type { Prisma } from "@hermes/orchestration-database";

import type { HttpTriggerExecutionDetail } from "./http-triggers";
import type { ManualPipelineExecutionDetail } from "./pipeline-executions";
import type { ScheduleExecutionDetail } from "./schedules";

export {
  isSensitiveJsonKey,
  maskSecretsInJson,
  SECRET_MASK,
} from "./json-secret-mask";

import { maskSecretsInJson } from "./json-secret-mask";

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
  execution: {
    ...detail.execution,
    errors: maskSecretsInJson(detail.execution.errors) as Prisma.JsonValue,
  },
  invocations: detail.invocations.map((inv) => ({
    ...inv,
    params: maskSecretsInJson(inv.params),
    invocationConfig:
      inv.invocationConfig == null
        ? null
        : maskSecretsInJson(inv.invocationConfig),
  })),
});

/**
 * HTTP trigger execution detail with `errors`, `metadata`, and per-invocation JSON masked for display.
 */
export const maskHttpTriggerExecutionDetailForDisplay = (
  detail: HttpTriggerExecutionDetail,
): HttpTriggerExecutionDetail => ({
  ...detail,
  execution: {
    ...detail.execution,
    errors: maskSecretsInJson(detail.execution.errors) as Prisma.JsonValue,
    metadata:
      detail.execution.metadata == null
        ? null
        : (maskSecretsInJson(detail.execution.metadata) as Prisma.JsonValue),
  },
  invocations: detail.invocations.map((inv) => ({
    ...inv,
    params: maskSecretsInJson(inv.params),
    invocationConfig:
      inv.invocationConfig == null
        ? null
        : maskSecretsInJson(inv.invocationConfig),
  })),
});

/**
 * Manual pipeline execution detail with `errors` and per-invocation JSON masked for display.
 */
export const maskManualPipelineExecutionDetailForDisplay = (
  detail: ManualPipelineExecutionDetail,
): ManualPipelineExecutionDetail => ({
  ...detail,
  execution: {
    ...detail.execution,
    errors: maskSecretsInJson(detail.execution.errors) as Prisma.JsonValue,
  },
  invocations: detail.invocations.map((inv) => ({
    ...inv,
    params: maskSecretsInJson(inv.params),
    invocationConfig:
      inv.invocationConfig == null
        ? null
        : maskSecretsInJson(inv.invocationConfig),
  })),
});
