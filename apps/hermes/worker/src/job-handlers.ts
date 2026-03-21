import got from "got";
import {
  AgentJobExecutionStatus,
  prisma as orchestrationPrisma,
} from "@workspace/orchestration-database";
import { createDomainIntegrationClient } from "@workspace/hermes-domain-contract";
import { env } from "@hermes/env/hermes-worker";
import { logger } from "@workspace/logger";
import type { JobHandlers } from "@nicnocquee/dataqueue";
import type { JobPayloadMap } from "./job-payload-map";
import { createAgentTokenClient } from "@workspace/agent-auth-client";
import { DEFAULT_TAKE, MAX_TAKE } from "@workspace/hermes-step-input-syntax";
import {
  executeSchedule,
  getDueSchedules,
  invokeAgent,
  type ExpandStepInputs,
  type InvokeAgentHttpClient,
} from "@workspace/hermes-scheduler";
import { getJobQueue } from "./queue";

/**
 * Creates an HTTP client that forwards the optional AbortSignal to got for request cancellation.
 */
const createHttpClient = (signal?: AbortSignal): InvokeAgentHttpClient => ({
  post: (url, options) =>
    got.post(url, {
      json: options.json,
      headers: options.headers,
      timeout: options.timeout,
      signal: options.signal ?? signal,
    }),
});

if (!env.AGENT_AUTH_API_URL || !env.AGENT_API_KEY) {
  throw new Error(
    "AGENT_AUTH_API_URL and AGENT_API_KEY are required for hermes-worker (JWT-only agent invocation)",
  );
}

/** JWT-only: worker mints short-lived tokens from auth API; never sends raw API key to agents. */
const tokenClient = createAgentTokenClient({
  authApiUrl: env.AGENT_AUTH_API_URL,
  credential: env.AGENT_API_KEY,
});

/**
 * Returns a short-lived JWT from the auth API for agent invocation.
 */
async function getAuthToken(): Promise<string> {
  return tokenClient.getToken();
}

/**
 * Resolves active domain integration URL from orchestration storage.
 *
 * @returns Base URL for expansion HTTP calls.
 */
const resolveDomainIntegrationBaseUrl = async (): Promise<string> => {
  const integration = await orchestrationPrisma.domainIntegration.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { baseUrl: true },
  });
  const baseUrl = integration?.baseUrl ?? env.MEDIAPULSE_API_URL;
  if (!baseUrl) {
    throw new Error(
      "No active domain integration found and MEDIAPULSE_API_URL is missing",
    );
  }
  return baseUrl;
};

const expandStepInputs: ExpandStepInputs = async (context) => {
  const baseUrl = await resolveDomainIntegrationBaseUrl();
  const domainClient = createDomainIntegrationClient({
    baseUrl,
    authToken: env.DOMAIN_INTEGRATION_AUTH_TOKEN,
  });
  const response = await domainClient.expandStepInputs({
    input: context.input,
    defaultTake: DEFAULT_TAKE,
    maxTake: env.HERMES_DATA_SOURCE_MAX_TAKE ?? MAX_TAKE,
  });
  return response.expandedInputs;
};

/**
 * DataQueue job handlers for Hermes.
 * check_schedules: polls due schedules and enqueues one invoke_agent job per expanded input.
 * invoke_agent: performs the HTTP call to the agent and updates AgentJobExecution.
 */
export const jobHandlers: JobHandlers<JobPayloadMap> = {
  check_schedules: async () => {
    const jobQueue = getJobQueue();
    const schedules = await getDueSchedules(orchestrationPrisma);
    for (const schedule of schedules) {
      try {
        await executeSchedule(schedule, {
          db: orchestrationPrisma,
          logger,
          enqueueAgentInvocations: async (payloads) => {
            await jobQueue.addJobs(
              payloads.map((p) => ({
                jobType: "invoke_agent" as const,
                payload: p,
                priority: p.priority,
                idempotencyKey: p.jobId,
              })),
            );
          },
          expandStepInputs,
          defaultTimeoutMs: 300_000,
          requireHttpsAgentEndpoints:
            env.REQUIRE_HTTPS_AGENT_ENDPOINTS === "true",
        });
      } catch (err) {
        logger.error(
          { err, scheduleId: schedule.id },
          "executeSchedule failed for schedule",
        );
      }
    }
  },

  invoke_agent: async (payload, signal) => {
    logger.info(
      {
        jobId: payload.jobId,
        agentId: payload.agentId,
        scheduleId: payload.scheduleId,
      },
      "invoke_agent started",
    );

    const claimed = await orchestrationPrisma.agentJobExecution.updateMany({
      where: { jobId: payload.jobId, status: AgentJobExecutionStatus.pending },
      data: {
        status: AgentJobExecutionStatus.running,
        startedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      return;
    }

    const httpClient = createHttpClient(signal);
    const authToken = await getAuthToken();
    const endpoint = { url: payload.endpointUrl, method: "POST" as const };
    try {
      await invokeAgent(
        endpoint,
        payload.body as Record<string, unknown>,
        {
          jobId: payload.jobId,
          executionId: payload.executionId,
          authToken,
          timeoutMs: payload.timeoutMs,
          signal,
        },
        httpClient,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        {
          err,
          jobId: payload.jobId,
          agentId: payload.agentId,
          scheduleId: payload.scheduleId,
        },
        "invoke_agent failed",
      );
      await orchestrationPrisma.agentJobExecution.update({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.failed,
          error: { message, retryable: true },
          completedAt: new Date(),
        },
      });
      throw err;
    }
  },
};
