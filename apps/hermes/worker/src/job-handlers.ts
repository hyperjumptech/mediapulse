import got from "got";
import {
  AgentJobExecutionStatus,
  DomainIntegrationStatus,
  Prisma,
  prisma as orchestrationPrisma,
} from "@hermes/orchestration-database";
import { decryptDomainIntegrationApiKeyWithFallback } from "@hermes/domain-integration-crypto";
import { createDomainIntegrationClient } from "@hermes/domain-contract";
import { env } from "@hermes/env/hermes-worker";
import { logger } from "@workspace/logger";
import type { JobContext, JobHandlers } from "@nicnocquee/dataqueue";
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
  parseHttpErrorBodyMessage,
  willRetryAfterTransientFailure,
  type ExpandStepInputs,
  type InvokeAgentHttpClient,
  type InvokeAgentJobPayload,
} from "@hermes/scheduler";
import { getJobQueue } from "./queue";
import { executeHttpTrigger } from "./execute-http-trigger";

/**
 * Parses optional positive integer env strings (DataQueue retry delay fields are in seconds).
 *
 * @param raw - Env value from `@hermes/env/hermes-worker`.
 * @returns Integer >= 1, or undefined when unset/invalid.
 */
const parsePositiveIntEnv = (raw: string | undefined): number | undefined => {
  if (raw == null || raw.trim() === "") {
    return undefined;
  }
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
};

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

if (!env.HERMES_INTERNAL_API_KEY) {
  throw new Error(
    "HERMES_INTERNAL_API_KEY is required for hermes-worker (JWT mint + decrypt)",
  );
}

/**
 * Mints a JWT using the decrypted domain integration API key (not the internal preset).
 *
 * @param domainIntegrationId - Orchestration `domain_integration.id` from the pipeline.
 */
async function getJwtForDomainIntegration(
  domainIntegrationId: string,
): Promise<string> {
  const row = await orchestrationPrisma.domainIntegration.findFirst({
    where: {
      id: domainIntegrationId,
      status: DomainIntegrationStatus.active,
      encryptedApiKey: { not: null },
    },
    select: { encryptedApiKey: true },
  });
  if (!row?.encryptedApiKey) {
    throw new Error(
      `No encrypted API key for domain integration ${domainIntegrationId}; complete dashboard setup and domain registration.`,
    );
  }
  const plaintext = decryptDomainIntegrationApiKeyWithFallback(
    row.encryptedApiKey,
    env.HERMES_INTERNAL_API_KEY,
    env.HERMES_INTERNAL_API_KEY_PREVIOUS,
  );
  return createAgentTokenClient({
    authApiUrl: env.AGENT_AUTH_API_URL,
    credential: plaintext,
  }).getToken();
}

const expandStepInputs: ExpandStepInputs = async (context) => {
  const integration = await orchestrationPrisma.domainIntegration.findFirst({
    where: {
      id: context.domainIntegrationId,
      status: DomainIntegrationStatus.active,
    },
    select: { baseUrl: true },
  });
  const baseUrl = integration?.baseUrl?.trim();
  if (!baseUrl) {
    throw new Error(
      "Domain integration has no base URL; register domain-api with Hermes before running pipelines that need step-input expansion.",
    );
  }
  const domainClient = createDomainIntegrationClient({
    baseUrl,
    authToken: await getJwtForDomainIntegration(context.domainIntegrationId),
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
 * Transport or 5xx: reset `AgentJobExecution` to `pending` when DataQueue will retry; otherwise
 * terminal failure via `applyInvocationCompletion`, then rethrow for the queue.
 *
 * @param params - Payload, user-facing message, and error to propagate to DataQueue.
 */
const handleTransientInvokeFailure = async (params: {
  payload: InvokeAgentJobPayload;
  message: string;
  errorToThrow: Error;
}): Promise<never> => {
  const { payload, message, errorToThrow } = params;
  const jobQueue = getJobQueue();

  if (payload.hermesDataQueueJobId == null) {
    await orchestrationPrisma.agentJobExecution.update({
      where: { jobId: payload.jobId },
      data: {
        status: AgentJobExecutionStatus.failed,
        error: { message, retryable: true },
        completedAt: new Date(),
      },
    });
    throw errorToThrow;
  }

  const dqJob = await jobQueue.getJob(payload.hermesDataQueueJobId);
  if (
    dqJob == null ||
    !willRetryAfterTransientFailure(dqJob.attempts, dqJob.maxAttempts)
  ) {
    await applyInvocationCompletion(
      {
        jobId: payload.jobId,
        scheduleExecutionId: payload.scheduleExecutionId,
        httpTriggerExecutionId: payload.httpTriggerExecutionId,
        pipelineStepId: payload.pipelineStepId,
        terminal: {
          status: AgentJobExecutionStatus.failed,
          error: { message, retryable: true },
        },
      },
      completionDeps,
    );
    throw errorToThrow;
  }

  await orchestrationPrisma.agentJobExecution.updateMany({
    where: {
      jobId: payload.jobId,
      status: AgentJobExecutionStatus.running,
    },
    data: {
      status: AgentJobExecutionStatus.pending,
      completedAt: null,
      error: {
        message,
        retryable: true,
        transient: true,
      },
    },
  });
  throw errorToThrow;
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
            const retryDelaySec = parsePositiveIntEnv(
              env.HERMES_INVOKE_AGENT_RETRY_DELAY,
            );
            const retryDelayMaxSec = parsePositiveIntEnv(
              env.HERMES_INVOKE_AGENT_RETRY_DELAY_MAX,
            );
            const backoffRaw = env.HERMES_INVOKE_AGENT_RETRY_BACKOFF?.trim();
            const retryBackoff =
              backoffRaw === "true"
                ? true
                : backoffRaw === "false"
                  ? false
                  : undefined;
            const jobDefs = items.map((item) => ({
              jobType: "invoke_agent" as const,
              payload: item.payload,
              priority: item.payload.priority,
              idempotencyKey: item.payload.jobId,
              maxAttempts,
              deadLetterJobType,
              ...(retryDelaySec !== undefined
                ? { retryDelay: retryDelaySec }
                : {}),
              ...(retryBackoff !== undefined ? { retryBackoff } : {}),
              ...(retryDelayMaxSec !== undefined
                ? { retryDelayMax: retryDelayMaxSec }
                : {}),
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
            }));
            const insertedIds = await jobQueue.addJobs(jobDefs);
            for (let i = 0; i < insertedIds.length; i++) {
              const queueJobId = insertedIds[i];
              const item = items[i];
              if (item === undefined || queueJobId === undefined) {
                continue;
              }
              await jobQueue.editJob(queueJobId, {
                payload: {
                  ...item.payload,
                  hermesDataQueueJobId: queueJobId,
                },
              });
            }
          },
          expandStepInputs,
          defaultTimeoutMs: 300_000,
          variableSecretMasterKey: env.HERMES_INTERNAL_API_KEY,
          variableSecretFallbackMasterKey: env.HERMES_INTERNAL_API_KEY_PREVIOUS,
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

  execute_http_trigger: async (payload) => {
    const jobQueue = getJobQueue();
    await executeHttpTrigger(payload.httpTriggerExecutionId, {
      db: orchestrationPrisma,
      enqueueAgentInvocations: async (items) => {
        const jobDefs = items.map((item) => ({
          jobType: "invoke_agent" as const,
          payload: item.payload,
          priority: item.payload.priority,
          idempotencyKey: item.payload.jobId,
          dependsOn:
            item.dependsOnBatchIndices && item.dependsOnBatchIndices.length > 0
              ? {
                  jobIds: item.dependsOnBatchIndices.map((idx) =>
                    batchDepRef(idx),
                  ),
                }
              : undefined,
          tags: [
            `httpTriggerExecution:${item.payload.httpTriggerExecutionId}`,
            `httpTrigger:${item.payload.httpTriggerId}`,
            `pipeline:${item.payload.pipelineId}`,
            `pipelineStep:${item.payload.pipelineStepId}`,
          ],
        }));
        const insertedIds = await jobQueue.addJobs(jobDefs);
        for (let idx = 0; idx < insertedIds.length; idx++) {
          const queueJobId = insertedIds[idx];
          const item = items[idx];
          if (item === undefined || queueJobId === undefined) continue;
          await jobQueue.editJob(queueJobId, {
            payload: { ...item.payload, hermesDataQueueJobId: queueJobId },
          });
        }
      },
      expandStepInputs,
      defaultTimeoutMs: 300_000,
      variableSecretMasterKey: env.HERMES_INTERNAL_API_KEY,
      variableSecretFallbackMasterKey: env.HERMES_INTERNAL_API_KEY_PREVIOUS,
    });
  },

  invoke_agent: async (payload, signal, _ctx: JobContext) => {
    void _ctx;
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

    if (payload.hermesDataQueueJobId != null) {
      try {
        const dqJob = await getJobQueue().getJob(payload.hermesDataQueueJobId);
        if (dqJob != null) {
          await orchestrationPrisma.agentJobExecution.update({
            where: { jobId: payload.jobId },
            data: {
              dataQueueAttempts: dqJob.attempts,
              dataQueueMaxAttempts: dqJob.maxAttempts,
            },
          });
        }
      } catch (err) {
        logger.warn(
          { err, jobId: payload.jobId },
          "invoke_agent: failed to sync DataQueue attempts to agent_job_execution",
        );
      }
    }

    if (!payload.scheduleExecutionId && !payload.httpTriggerExecutionId) {
      logger.error(
        { jobId: payload.jobId },
        "invoke_agent missing execution id on payload",
      );
      await orchestrationPrisma.agentJobExecution.update({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.failed,
          error: {
            message:
              "Missing scheduleExecutionId/httpTriggerExecutionId on job payload",
            retryable: false,
          },
          completedAt: new Date(),
        },
      });
      return;
    }

    const httpClient = createHttpClient(signal);
    const authToken = await getJwtForDomainIntegration(
      payload.domainIntegrationId,
    );
    const endpoint = { url: payload.endpointUrl, method: "POST" as const };
    const postResult = await invokeAgentPost(
      endpoint,
      payload.body as Record<string, unknown>,
      {
        jobId: payload.jobId,
        executionId: payload.executionId,
        scheduleId: payload.scheduleId ?? payload.httpTriggerId,
        scheduleExecutionId:
          payload.scheduleExecutionId ?? payload.httpTriggerExecutionId,
        pipelineStepId: payload.pipelineStepId,
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
      await handleTransientInvokeFailure({
        payload,
        message: postResult.error.message,
        errorToThrow: postResult.error,
      });
    } else {
      const { statusCode, rawBody, isEmptyBody } = postResult.response;

      if (statusCode >= 500) {
        const bodyMessage = parseHttpErrorBodyMessage(rawBody);
        const message = bodyMessage ?? `Agent HTTP ${statusCode}`;
        const err = new Error(`Agent returned HTTP ${statusCode}`);
        await handleTransientInvokeFailure({
          payload,
          message,
          errorToThrow: err,
        });
      }

      if (statusCode >= 400) {
        const bodyMessage = parseHttpErrorBodyMessage(rawBody);
        await applyInvocationCompletion(
          {
            jobId: payload.jobId,
            scheduleExecutionId: payload.scheduleExecutionId,
            httpTriggerExecutionId: payload.httpTriggerExecutionId,
            pipelineStepId: payload.pipelineStepId,
            terminal: {
              status: AgentJobExecutionStatus.failed,
              error: {
                message: bodyMessage ?? `HTTP ${statusCode}`,
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
              httpTriggerExecutionId: payload.httpTriggerExecutionId,
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
              httpTriggerExecutionId: payload.httpTriggerExecutionId,
              pipelineStepId: payload.pipelineStepId,
              terminal: {
                status: AgentJobExecutionStatus.failed,
                error: {
                  message:
                    parsed.envelope.message ??
                    "Agent reported semantic failure",
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
            httpTriggerExecutionId: payload.httpTriggerExecutionId,
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
          httpTriggerExecutionId: payload.httpTriggerExecutionId,
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
    }
  },
};
