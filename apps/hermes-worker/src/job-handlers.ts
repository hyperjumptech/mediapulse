import got from "got";
import { AgentJobExecutionStatus } from "@workspace/database";
import { prisma } from "@workspace/database";
import { env } from "@workspace/env/hermes-worker";
import { logger } from "@workspace/logger";
import type { JobHandlers } from "@nicnocquee/dataqueue";
import type { JobPayloadMap } from "./job-payload-map";
import { createAgentTokenClient } from "@workspace/agent-auth-client";
import {
  executeSchedule,
  getDueSchedules,
  invokeAgent,
  type InvokeAgentHttpClient,
} from "@workspace/hermes-scheduler";
import { getJobQueue } from "./queue";

const httpClient: InvokeAgentHttpClient = {
  post: (url, options) =>
    got.post(url, {
      json: options.json,
      headers: options.headers,
      timeout: options.timeout,
    }),
};

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
 * DataQueue job handlers for Hermes.
 * check_schedules: polls due schedules and enqueues one invoke_agent job per expanded input.
 * invoke_agent: performs the HTTP call to the agent and updates AgentJobExecution.
 */
export const jobHandlers: JobHandlers<JobPayloadMap> = {
  check_schedules: async () => {
    const jobQueue = getJobQueue();
    const schedules = await getDueSchedules(prisma);
    for (const schedule of schedules) {
      try {
        await executeSchedule(schedule, {
          db: prisma,
          logger,
          enqueueAgentInvocation: async (payload) => {
            await jobQueue.addJob({
              jobType: "invoke_agent",
              payload,
              priority: payload.priority,
            });
          },
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

  invoke_agent: async (payload) => {
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
        },
        httpClient,
      );
      await prisma.agentJobExecution.update({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.running,
          startedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.agentJobExecution
        .update({
          where: { jobId: payload.jobId },
          data: {
            status: AgentJobExecutionStatus.failed,
            error: { message, retryable: true },
            completedAt: new Date(),
          },
        })
        .catch(() => {});
    }
  },
};
