import type { ScheduleExecutionDetail } from "@/lib/schedules";

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
  invocations: detail.invocations.map((inv) => ({
    ...inv,
    params: maskSecretsInJson(inv.params),
    invocationConfig:
      inv.invocationConfig == null
        ? null
        : maskSecretsInJson(inv.invocationConfig),
  })),
});
