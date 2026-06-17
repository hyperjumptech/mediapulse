/** Activity heartbeat status accepted by agent-registry-api. */
export type AgentActivityStatus = "processing" | "completed";

export type ActivityReporterOptions = {
  /** Base URL of agent-registry-api (e.g. `https://registry.example.com`). */
  registryUrl: string;
  /** Hermes job id from `X-Job-Id`; when absent, reports are no-ops. */
  jobId: string | undefined;
  /** Bearer token for `Authorization` header; when absent, reports are no-ops. */
  token: string | undefined;
  /** Optional fetch implementation (tests). */
  fetchFn?: typeof fetch;
};

export type ActivityReporter = (
  title: string,
  description?: string,
  status?: AgentActivityStatus,
) => void;

/**
 * Creates a fire-and-forget activity reporter that POSTs heartbeats to
 * `POST {registryUrl}/api/agent-activity`.
 *
 * @param options - Registry URL, job id, token, and optional fetch override.
 * @returns Callable reporter; no-ops when `jobId` or `token` is missing.
 */
export const createActivityReporter = (
  options: ActivityReporterOptions,
): ActivityReporter => {
  const { registryUrl, jobId, token, fetchFn = fetch } = options;

  return (
    title: string,
    description?: string,
    status: AgentActivityStatus = "processing",
  ) => {
    if (!jobId || !token) {
      return;
    }

    void fetchFn(`${registryUrl}/api/agent-activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ jobId, title, description, status }),
    }).catch(() => {});
  };
};
