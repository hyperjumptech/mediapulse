/**
 * Resolves the single user-facing outcome label for an invocation row.
 * Prefers semantic `success` / `failure` when set; otherwise infers from job status.
 *
 * @param jobStatus - Raw `AgentJobExecution` status (e.g. pending, running, completed, failed).
 * @param semanticStatus - Agent envelope outcome when present.
 * @returns Lowercase outcome (`success`, `failure`) or non-terminal job status for in-flight rows.
 */
export const resolveInvocationOutcomeLabel = (
  jobStatus: string,
  semanticStatus: string | null,
): string => {
  if (semanticStatus === "success" || semanticStatus === "failure") {
    return semanticStatus;
  }
  if (jobStatus === "completed") {
    return "success";
  }
  if (jobStatus === "failed") {
    return "failure";
  }
  return jobStatus;
};
