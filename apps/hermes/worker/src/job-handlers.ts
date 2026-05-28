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
import { cleanupOrphanedExecutions } from "./cleanup-orphaned-executions";

/** Default cap for DataQueue `invoke_agent` job timeout (abort + supervisor reclaim). */
export const DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS = 1_800_000;

type ResolvedDataQueueJob = {
  id: number;
  attempts: number;
  max_attempts: number;
};

/**
 * Looks up a DataQueue row by `idempotency_key` (same value as `InvokeAgentJobPayload.jobId`).
 * Avoids post-enqueue `editJob` payload patches that briefly lock rows and cause batch claim races.
 *
 * @param logicalJobId - Hermes agent job id used as DataQueue idempotency key.
 * @param jobQueue - Optional queue instance for tests.
 * @returns Row metadata when found; otherwise null.
 */
export const resolveDataQueueJob = async (
  logicalJobId: string,
  jobQueue = getJobQueue(),
): Promise<ResolvedDataQueueJob | null> => {
  const pool = jobQueue.getPool?.();
  if (pool == null) {
    return null;
  }
  const result = await pool.query<ResolvedDataQueueJob>(
    `SELECT id, attempts, max_attempts
     FROM job_queue
     WHERE idempotency_key = $1
     LIMIT 1`,
    [logicalJobId],
  );
  return result.rows[0] ?? null;
};

/**
 * Caps DataQueue job-level timeout so a hung agent invoke cannot block the processor batch
 * for the full agent HTTP deadline (which may be hours).
 *
 * @param agentTimeoutMs - Agent HTTP timeout from pipeline/schedule config.
 * @param capMs - Optional override cap in milliseconds.
 * @returns Min of agent timeout and cap.
 */
export const resolveInvokeAgentJobTimeoutMs = (
  agentTimeoutMs: number,
  capMs?: number,
): number =>
  Math.min(agentTimeoutMs, capMs ?? DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS);

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
      NOT: { encryptedPayload: null },
    },
    select: { encryptedPayload: { select: { ciphertext: true } } },
  });
  const ciphertext = row?.encryptedPayload?.ciphertext;
  if (!ciphertext) {
    throw new Error(
      `No encrypted API key for domain integration ${domainIntegrationId}; complete dashboard setup and domain registration.`,
    );
  }
  const plaintext = decryptDomainIntegrationApiKeyWithFallback(
    ciphertext,
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

  const dqJob = await resolveDataQueueJob(payload.jobId);
  if (dqJob == null) {
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

  if (!willRetryAfterTransientFailure(dqJob.attempts, dqJob.max_attempts)) {
    await applyInvocationCompletion(
      {
        jobId: payload.jobId,
        scheduleExecutionId: payload.scheduleExecutionId,
        httpTriggerExecutionId: payload.httpTriggerExecutionId,
        manualExecutionId: payload.manualExecutionId,
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
            const invokeAgentJobTimeoutCapMs =
              parsePositiveIntEnv(env.HERMES_INVOKE_AGENT_JOB_TIMEOUT_MS) ??
              DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS;
            const jobDefs = items.map((item) => ({
              jobType: "invoke_agent" as const,
              payload: item.payload,
              priority: item.payload.priority,
              idempotencyKey: item.payload.jobId,
              // Cap DataQueue job timeout below agent HTTP deadline so a hung invoke
              // frees a processor slot and supervisor reclaim runs within minutes, not hours.
              timeoutMs: resolveInvokeAgentJobTimeoutMs(
                item.payload.timeoutMs,
                invokeAgentJobTimeoutCapMs,
              ),
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
            await jobQueue.addJobs(jobDefs);
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
        const invokeAgentJobTimeoutCapMs =
          parsePositiveIntEnv(env.HERMES_INVOKE_AGENT_JOB_TIMEOUT_MS) ??
          DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS;
        const jobDefs = items.map((item) => ({
          jobType: "invoke_agent" as const,
          payload: item.payload,
          priority: item.payload.priority,
          idempotencyKey: item.payload.jobId,
          timeoutMs: resolveInvokeAgentJobTimeoutMs(
            item.payload.timeoutMs,
            invokeAgentJobTimeoutCapMs,
          ),
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
        await jobQueue.addJobs(jobDefs);
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

    // Claim either a pending record (first attempt) or an already-running record left
    // behind by a prior attempt whose worker process crashed before completing. When
    // DataQueue's stuckJobsTimeout recovers the DataQueue job and retries it, the
    // orchestration row is still "running" because the crash left no cleanup path.
    // Including "running" here lets the retry re-enter and drive the row to a terminal
    // state via applyInvocationCompletion or handleTransientInvokeFailure.
    const claimed = await orchestrationPrisma.agentJobExecution.updateMany({
      where: {
        jobId: payload.jobId,
        status: {
          in: [
            AgentJobExecutionStatus.pending,
            AgentJobExecutionStatus.running,
          ],
        },
      },
      data: {
        status: AgentJobExecutionStatus.running,
        startedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      return;
    }

    try {
      const dqJob = await resolveDataQueueJob(payload.jobId);
      if (dqJob != null) {
        await orchestrationPrisma.agentJobExecution.update({
          where: { jobId: payload.jobId },
          data: {
            dataQueueAttempts: dqJob.attempts,
            dataQueueMaxAttempts: dqJob.max_attempts,
          },
        });
      }
    } catch (err) {
      logger.warn(
        { err, jobId: payload.jobId },
        "invoke_agent: failed to sync DataQueue attempts to agent_job_execution",
      );
    }

    const hasParentExecution =
      Boolean(payload.scheduleExecutionId) ||
      Boolean(payload.httpTriggerExecutionId) ||
      Boolean(payload.manualExecutionId);
    if (!hasParentExecution) {
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
              "Missing scheduleExecutionId/httpTriggerExecutionId/manualExecutionId on job payload",
            retryable: false,
          },
          completedAt: new Date(),
        },
      });
      return;
    }

    const parentExecution = payload.scheduleExecutionId
      ? await orchestrationPrisma.scheduleExecution.findUnique({
          where: { id: payload.scheduleExecutionId },
          select: { cancelledAt: true },
        })
      : payload.httpTriggerExecutionId
        ? await orchestrationPrisma.httpTriggerExecution.findUnique({
            where: { id: payload.httpTriggerExecutionId },
            select: { cancelledAt: true },
          })
        : await orchestrationPrisma.manualPipelineExecution.findUnique({
            where: { id: payload.manualExecutionId! },
            select: { cancelledAt: true },
          });

    if (parentExecution?.cancelledAt) {
      await applyInvocationCompletion(
        {
          jobId: payload.jobId,
          scheduleExecutionId: payload.scheduleExecutionId,
          httpTriggerExecutionId: payload.httpTriggerExecutionId,
          manualExecutionId: payload.manualExecutionId,
          pipelineStepId: payload.pipelineStepId,
          terminal: {
            status: AgentJobExecutionStatus.cancelled,
            error: {
              cancelled: true,
              message: "Execution was cancelled before agent invoke",
              retryable: false,
            },
          },
        },
        completionDeps,
      );
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
        manualExecutionId: payload.manualExecutionId,
        pipelineStepId: payload.pipelineStepId,
        authToken,
        timeoutMs: payload.timeoutMs,
        signal,
      },
      httpClient,
    );

    if (postResult.kind === "transport_error") {
      const aborted =
        signal.aborted ||
        postResult.error.name === "AbortError" ||
        /abort/i.test(postResult.error.message);
      if (aborted) {
        await applyInvocationCompletion(
          {
            jobId: payload.jobId,
            scheduleExecutionId: payload.scheduleExecutionId,
            httpTriggerExecutionId: payload.httpTriggerExecutionId,
            manualExecutionId: payload.manualExecutionId,
            pipelineStepId: payload.pipelineStepId,
            terminal: {
              status: AgentJobExecutionStatus.cancelled,
              error: {
                cancelled: true,
                message: "Agent invoke aborted (cancelled or signal)",
                retryable: false,
              },
            },
          },
          completionDeps,
        );
        return;
      }
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
      if (signal.aborted) {
        await applyInvocationCompletion(
          {
            jobId: payload.jobId,
            scheduleExecutionId: payload.scheduleExecutionId,
            httpTriggerExecutionId: payload.httpTriggerExecutionId,
            manualExecutionId: payload.manualExecutionId,
            pipelineStepId: payload.pipelineStepId,
            terminal: {
              status: AgentJobExecutionStatus.cancelled,
              error: {
                cancelled: true,
                message: "Agent invoke aborted after response (cancelled)",
                retryable: false,
              },
            },
          },
          completionDeps,
        );
        return;
      }

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
            manualExecutionId: payload.manualExecutionId,
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
              manualExecutionId: payload.manualExecutionId,
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
              manualExecutionId: payload.manualExecutionId,
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
            manualExecutionId: payload.manualExecutionId,
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
          manualExecutionId: payload.manualExecutionId,
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

  cleanup_orphaned_executions: async () => {
    const resolved = await cleanupOrphanedExecutions({
      db: orchestrationPrisma,
      logger,
    });
    logger.info({ resolved }, "cleanup_orphaned_executions: sweep complete");
  },
};
