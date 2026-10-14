import type { PostDeliveryRunBody } from "@workspace/agent-data-api-contract";

import type { RecipientSendResult } from "./deliver-newsletter.js";

export type RunOutcomeRow = { status: "success" | "failed" | "skipped" };

export const aggregateRunOutcome = (
  results: RunOutcomeRow[],
): PostDeliveryRunBody["outcome"] => {
  if (results.length === 0) {
    return "skipped";
  }
  const success = results.filter((row) => row.status === "success").length;
  const failed = results.filter((row) => row.status === "failed").length;
  if (failed > 0 && success > 0) {
    return "partial_success";
  }
  if (failed > 0) {
    return "failed";
  }

  return success === 0 ? "skipped_all_already_delivered" : "success";
};

export const toDeliveryRecipientRow = (
  result: RecipientSendResult,
): PostDeliveryRunBody["recipients"][number] => ({
  userTickerId: result.userTickerId,
  status: result.status,
  attempts: result.attempts,
  lastErrorCode: result.lastErrorCode ?? null,
  lastErrorMessage: result.lastErrorMessage ?? null,
  errorCategory: result.errorCategory ?? null,
  resendEmailId: result.resendEmailId ?? null,
});
