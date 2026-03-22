import got from "got";
import {
  AgentJobExecutionStatus,
  Prisma,
  prisma as orchestrationPrisma,
} from "@hermes/orchestration-database";
import { createDomainIntegrationClient } from "@hermes/domain-contract";
import { env } from "@hermes/env/hermes-worker";
import { logger } from "@workspace/logger";
import type { JobHandlers } from "@nicnocquee/dataqueue";
import { batchDepRef } from "@nicnocquee/dataqueue";
import type { JobPayloadMap } from "./job-payload-map";
import { createAgentTokenClient } from "@workspace/agent-auth-client";
import { DEFAULT_TAKE, MAX_TAKE } from "@hermes/step-input-syntax";
import {
  applyInvocationCompletion,
  executeSchedule,
  getDueSchedules,
  invokeAgentPost,
  parseAgentResponseEnvelope,
  type ExpandStepInputs,
  type InvokeAgentHttpClient,
} from "@hermes/scheduler";
import { getJobQueue } from "./queue";

/**
 * Creates an HTTP client that forwards the optional AbortSignal to got for request cancellation.
 * Uses `throwHttpErrors: false` and `responseType: 'text'` so status and body are handled per PRD §8.
 */
const createHttpClient = (signal?: AbortSignal): InvokeAgentHttpClient => ({
  post: async (url, options) => {
    const res = await got.post(url, {
      json: options.json,
      headers: options.headers,
      timeout: options.timeout,
      signal: options.signal ?? signal,
      throwHttpErrors: false,
      responseType: "text",
    });
    const rawBody =
      typeof res.body === "string" ? res.body : String(res.body ?? "");
    return {
      statusCode: res.statusCode,
      rawBody,
      isEmptyBody: rawBody.length === 0,
    };
  },
});

if (!env.AGENT_AUTH_API_URL || !env.HERMES_INTERNAL_API_KEY) {
  throw new Error(
    "AGENT_AUTH_API_URL and HERMES_INTERNAL_API_KEY are required for hermes-worker (JWT-only agent invocation)",
  );
}

/** JWT-only: worker mints short-lived tokens from auth API; never sends the internal key to agents. */
const tokenClient = createAgentTokenClient({
  authApiUrl: env.AGENT_AUTH_API_URL,
  credential: env.HERMES_INTERNAL_API_KEY,
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

const completionDeps = {
  db: orchestrationPrisma,
  logger: { warn: logger.warn.bind(logger), error: logger.error.bind(logger) },
};

/**
 * DataQueue job handlers for Hermes.
 * check_schedules: polls due schedules and enqueues invoke_agent jobs.
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
          enqueueAgentInvocations: async (items) => {
            const maxAttempts = env.HERMES_INVOKE_AGENT_MAX_ATTEMPTS
              ? Math.max(
                  1,
                  Number.parseInt(env.HERMES_INVOKE_AGENT_MAX_ATTEMPTS, 10) ||
                    1,
                )
              : undefined;
            const deadLetterJobType =
              env.HERMES_INVOKE_AGENT_DLQ_JOB_TYPE?.trim() || undefined;
            await jobQueue.addJobs(
              items.map((item) => ({
                jobType: "invoke_agent" as const,
                payload: item.payload,
                priority: item.payload.priority,
                idempotencyKey: item.payload.jobId,
                maxAttempts,
                deadLetterJobType,
                dependsOn:
                  item.dependsOnBatchIndices?.length &&
                  item.dependsOnBatchIndices.length > 0
                    ? {
                        jobIds: item.dependsOnBatchIndices.map((i) =>
                          batchDepRef(i),
                        ),
                      }
                    : undefined,
                tags: [
                  `scheduleExecution:${item.payload.scheduleExecutionId}`,
                  `schedule:${item.payload.scheduleId}`,
                  `pipeline:${item.payload.pipelineId}`,
                  `pipelineStep:${item.payload.pipelineStepId}`,
                ],
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

    if (!payload.scheduleExecutionId) {
      logger.error(
        { jobId: payload.jobId },
        "invoke_agent missing scheduleExecutionId on payload",
      );
      await orchestrationPrisma.agentJobExecution.update({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.failed,
          error: {
            message: "Missing scheduleExecutionId on job payload",
            retryable: false,
          },
          completedAt: new Date(),
        },
      });
      return;
    }

    const httpClient = createHttpClient(signal);
    const authToken = await getAuthToken();
    const endpoint = { url: payload.endpointUrl, method: "POST" as const };
    const postResult = await invokeAgentPost(
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

    if (postResult.kind === "transport_error") {
      logger.error(
        {
          err: postResult.error,
          jobId: payload.jobId,
          agentId: payload.agentId,
          scheduleId: payload.scheduleId,
        },
        "invoke_agent transport failure",
      );
      await orchestrationPrisma.agentJobExecution.update({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.failed,
          error: {
            message: postResult.error.message,
            retryable: true,
          },
          completedAt: new Date(),
        },
      });
      throw postResult.error;
    }

    const { statusCode, rawBody, isEmptyBody } = postResult.response;

    if (statusCode >= 500) {
      await orchestrationPrisma.agentJobExecution.update({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.failed,
          error: {
            message: `Agent HTTP ${statusCode}`,
            retryable: true,
          },
          completedAt: new Date(),
        },
      });
      throw new Error(`Agent returned HTTP ${statusCode}`);
    }

    if (statusCode >= 400) {
      await applyInvocationCompletion(
        {
          jobId: payload.jobId,
          scheduleExecutionId: payload.scheduleExecutionId,
          pipelineStepId: payload.pipelineStepId,
          terminal: {
            status: AgentJobExecutionStatus.failed,
            error: {
              message: `HTTP ${statusCode}`,
              retryable: false,
            },
          },
        },
        completionDeps,
      );
      return;
    }

    if (statusCode >= 200 && statusCode < 300) {
      const parsed = parseAgentResponseEnvelope(rawBody, isEmptyBody);
      if (!parsed.ok) {
        await applyInvocationCompletion(
          {
            jobId: payload.jobId,
            scheduleExecutionId: payload.scheduleExecutionId,
            pipelineStepId: payload.pipelineStepId,
            terminal: {
              status: AgentJobExecutionStatus.failed,
              error: {
                message: parsed.error.message,
                code: parsed.error.code,
                retryable: false,
              },
            },
          },
          completionDeps,
        );
        return;
      }
      if (parsed.envelope.status === "failure") {
        await applyInvocationCompletion(
          {
            jobId: payload.jobId,
            scheduleExecutionId: payload.scheduleExecutionId,
            pipelineStepId: payload.pipelineStepId,
            terminal: {
              status: AgentJobExecutionStatus.failed,
              error: {
                message:
                  parsed.envelope.message ?? "Agent reported semantic failure",
                retryable: false,
                semantic: true,
              },
              agentResponse:
                parsed.envelope as unknown as Prisma.InputJsonValue,
              semanticStatus: "failure",
            },
          },
          completionDeps,
        );
        return;
      }
      await applyInvocationCompletion(
        {
          jobId: payload.jobId,
          scheduleExecutionId: payload.scheduleExecutionId,
          pipelineStepId: payload.pipelineStepId,
          terminal: {
            status: AgentJobExecutionStatus.completed,
            envelope: parsed.envelope,
          },
        },
        completionDeps,
      );
      return;
    }

    await applyInvocationCompletion(
      {
        jobId: payload.jobId,
        scheduleExecutionId: payload.scheduleExecutionId,
        pipelineStepId: payload.pipelineStepId,
        terminal: {
          status: AgentJobExecutionStatus.failed,
          error: {
            message: `Unexpected HTTP status ${statusCode}`,
            retryable: false,
          },
        },
      },
      completionDeps,
    );
  },
};
