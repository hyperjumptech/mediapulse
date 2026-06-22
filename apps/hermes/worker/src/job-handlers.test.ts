/** @vitest-environment node */
import type { JobContext } from "@nicnocquee/dataqueue";
import { AgentJobExecutionStatus } from "@hermes/orchestration-database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyInvocationCompletion,
  executeSchedule,
  getDueSchedules,
  invokeAgentPost,
  parseAgentResponseEnvelope,
  reconcileZombieExecutions,
} from "@hermes/scheduler";
import { logger } from "@workspace/logger";
import { executeHttpTrigger } from "./execute-http-trigger";
import { cleanupOrphanedExecutions } from "./cleanup-orphaned-executions";
import { reconcileOrphanedPendingExecutions } from "./reconcile-orphaned-pending";
import {
  DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS,
  jobHandlers,
  resolveDataQueueJob,
  resolveInvokeAgentJobTimeoutMs,
} from "./job-handlers";

const mockPrisma = vi.hoisted(() => ({
  agentJobExecution: {
    update: vi.fn().mockResolvedValue(undefined),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  scheduleExecution: {
    findUnique: vi.fn().mockResolvedValue({ cancelledAt: null }),
  },
  httpTriggerExecution: {
    findUnique: vi.fn().mockResolvedValue({ cancelledAt: null }),
  },
  manualPipelineExecution: {
    findUnique: vi.fn().mockResolvedValue({ cancelledAt: null }),
  },
  domainIntegration: {
    findFirst: vi.fn().mockResolvedValue({
      baseUrl: "https://mediapulse-domain.example",
      encryptedPayload: { ciphertext: "{}" },
    }),
  },
}));

vi.mock("@hermes/domain-integration-crypto", () => ({
  decryptDomainIntegrationApiKeyWithFallback: () => "decrypted-test-key",
}));

vi.mock("@hermes/orchestration-database", () => ({
  AgentJobExecutionStatus: {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
    cancelled: "cancelled",
  },
  DomainIntegrationStatus: {
    pending: "pending",
    active: "active",
  },
  prisma: mockPrisma,
}));

vi.mock("@hermes/env/hermes-worker", () => ({
  env: {
    HERMES_INTERNAL_API_KEY: "test-internal-hermes-key",
    HERMES_INTERNAL_API_KEY_PREVIOUS: undefined as string | undefined,
    AGENT_AUTH_API_URL: "https://auth.example.com",
    REQUIRE_HTTPS_AGENT_ENDPOINTS: undefined as string | undefined,
    HERMES_INVOKE_AGENT_RETRY_DELAY: undefined as string | undefined,
    HERMES_INVOKE_AGENT_RETRY_BACKOFF: undefined as string | undefined,
    HERMES_INVOKE_AGENT_RETRY_DELAY_MAX: undefined as string | undefined,
    HERMES_INVOKE_AGENT_JOB_TIMEOUT_MS: undefined as string | undefined,
    HERMES_INVOKE_AGENT_CANCEL_POLL_MS: undefined as string | undefined,
  },
}));

vi.mock("@workspace/agent-auth-client", () => ({
  createAgentTokenClient: () => ({
    getToken: () => Promise.resolve("test-jwt-token"),
  }),
}));

vi.mock("@workspace/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@hermes/scheduler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hermes/scheduler")>();
  return {
    ...actual,
    getDueSchedules: vi.fn(),
    executeSchedule: vi.fn(),
    invokeAgentPost: vi.fn(),
    parseAgentResponseEnvelope: vi.fn(),
    applyInvocationCompletion: vi.fn().mockResolvedValue(undefined),
    reconcileZombieExecutions: vi.fn().mockResolvedValue(0),
  };
});

const mockAddJobs = vi.fn().mockResolvedValue([1]);
const mockPoolQuery = vi.fn();

vi.mock("./cleanup-orphaned-executions", () => ({
  cleanupOrphanedExecutions: vi.fn().mockResolvedValue(0),
}));

vi.mock("./reconcile-orphaned-pending", () => ({
  reconcileOrphanedPendingExecutions: vi
    .fn()
    .mockResolvedValue({ reEnqueued: 0, settled: 0 }),
}));

vi.mock("./execute-http-trigger", () => ({
  executeHttpTrigger: vi.fn(),
}));

vi.mock("./queue", () => ({
  getJobQueue: () => ({
    addJobs: mockAddJobs,
    getPool: () => ({
      query: mockPoolQuery,
    }),
  }),
}));

describe("jobHandlers", () => {
  beforeEach(() => {
    vi.mocked(getDueSchedules).mockClear();
    vi.mocked(executeSchedule).mockClear();
    vi.mocked(logger.error).mockClear();
    mockAddJobs.mockClear();
    mockPoolQuery.mockClear();
    mockAddJobs.mockResolvedValue([1]);
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("check_schedules", () => {
    it("calls getDueSchedules with prisma and does not call executeSchedule when no schedules are due", async () => {
      // Setup
      const { prisma } = await import("@hermes/orchestration-database");
      vi.mocked(getDueSchedules).mockResolvedValue([]);

      // Act
      await jobHandlers.check_schedules(
        {},
        new AbortController().signal,
        {} as Parameters<typeof jobHandlers.check_schedules>[2],
      );

      // Assert
      expect(getDueSchedules).toHaveBeenCalledTimes(1);
      expect(getDueSchedules).toHaveBeenCalledWith(prisma);
      expect(executeSchedule).not.toHaveBeenCalled();
    });

    it("calls executeSchedule once per due schedule with correct deps", async () => {
      // Setup
      const { prisma } = await import("@hermes/orchestration-database");
      const fakeSchedule = {
        id: "schedule-1",
        enabled: true,
        nextRunAt: new Date(),
        pipelineId: "pipeline-1",
        cronExpression: "0 * * * *",
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
        pipeline: {
          id: "pipeline-1",
          name: "Test",
          domainIntegrationId: "di-1",
          executionConfig: null,
          steps: [],
        },
      } as unknown as Awaited<ReturnType<typeof getDueSchedules>>[number];
      vi.mocked(getDueSchedules).mockResolvedValue([fakeSchedule]);
      vi.mocked(executeSchedule).mockResolvedValue(undefined);

      // Act
      await jobHandlers.check_schedules(
        {},
        new AbortController().signal,
        {} as Parameters<typeof jobHandlers.check_schedules>[2],
      );

      // Assert
      expect(getDueSchedules).toHaveBeenCalledWith(prisma);
      expect(executeSchedule).toHaveBeenCalledTimes(1);
      expect(executeSchedule).toHaveBeenCalledWith(fakeSchedule, {
        db: prisma,
        logger,
        enqueueAgentInvocations: expect.any(Function),
        expandStepInputs: expect.any(Function),
        defaultTimeoutMs: 300_000,
        variableSecretMasterKey: "test-internal-hermes-key",
        variableSecretFallbackMasterKey: undefined,
        requireHttpsAgentEndpoints: false,
      });
      const firstCall = vi.mocked(executeSchedule).mock.calls[0];
      const enqueueAgentInvocations = firstCall?.[1]?.enqueueAgentInvocations;
      expect(enqueueAgentInvocations).toBeDefined();
      await enqueueAgentInvocations!([
        {
          payload: {
            jobId: "j1",
            executionId: "e1",
            scheduleExecutionId: "se-1",
            scheduleId: "s1",
            pipelineId: "p1",
            pipelineStepId: "st1",
            domainIntegrationId: "di-1",
            agentId: "a1",
            agentVersion: "1.0.0",
            endpointUrl: "https://a.example/",
            body: { input: {}, config: {} },
            timeoutMs: 60_000,
            priority: 0,
          },
        },
      ]);
      expect(mockAddJobs).toHaveBeenCalledTimes(1);
      const firstCallArgs = mockAddJobs.mock.calls[0];
      expect(firstCallArgs).toBeDefined();
      const jobOptions = firstCallArgs![0] as Array<{
        jobType: string;
        payload: unknown;
        priority: number;
        idempotencyKey: string;
      }>;
      expect(jobOptions).toHaveLength(1);
      expect(jobOptions[0]).toMatchObject({
        jobType: "invoke_agent",
        payload: expect.objectContaining({ jobId: "j1" }),
        priority: 0,
        idempotencyKey: "j1",
        timeoutMs: 60_000,
        group: { id: "pipeline:p1" },
      });
    });

    it("caps DataQueue job timeoutMs at DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS when agent timeout is larger", async () => {
      const { prisma } = await import("@hermes/orchestration-database");
      const fakeSchedule = {
        id: "schedule-cap",
        enabled: true,
        nextRunAt: new Date(),
        pipelineId: "pipeline-cap",
        cronExpression: "0 * * * *",
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
        pipeline: {
          id: "pipeline-cap",
          name: "Test",
          domainIntegrationId: "di-1",
          executionConfig: null,
          steps: [],
        },
      } as unknown as Awaited<ReturnType<typeof getDueSchedules>>[number];
      vi.mocked(getDueSchedules).mockResolvedValue([fakeSchedule]);
      vi.mocked(executeSchedule).mockImplementation(async (_schedule, deps) => {
        await deps.enqueueAgentInvocations([
          {
            payload: {
              jobId: "j-cap",
              executionId: "e-cap",
              scheduleExecutionId: "se-cap",
              scheduleId: "s-cap",
              pipelineId: "p-cap",
              pipelineStepId: "st-cap",
              domainIntegrationId: "di-1",
              agentId: "a1",
              agentVersion: "1.0.0",
              endpointUrl: "https://a.example/",
              body: { input: {}, config: {} },
              timeoutMs: 7_200_000,
              priority: 0,
            },
          },
        ]);
      });

      await jobHandlers.check_schedules(
        {},
        new AbortController().signal,
        {} as Parameters<typeof jobHandlers.check_schedules>[2],
      );

      expect(executeSchedule).toHaveBeenCalledWith(fakeSchedule, {
        db: prisma,
        logger,
        enqueueAgentInvocations: expect.any(Function),
        expandStepInputs: expect.any(Function),
        defaultTimeoutMs: 300_000,
        variableSecretMasterKey: "test-internal-hermes-key",
        variableSecretFallbackMasterKey: undefined,
        requireHttpsAgentEndpoints: false,
      });
      const jobOptions = mockAddJobs.mock.calls[0]![0] as Array<{
        timeoutMs: number;
        payload: { timeoutMs: number };
      }>;
      expect(jobOptions[0]!.timeoutMs).toBe(
        DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS,
      );
      expect(jobOptions[0]!.payload.timeoutMs).toBe(7_200_000);
    });

    it("logs error and continues when executeSchedule throws for a schedule", async () => {
      // Setup
      const fakeSchedule = {
        id: "schedule-2",
        enabled: true,
        nextRunAt: new Date(),
        pipelineId: "pipeline-2",
        cronExpression: "0 * * * *",
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
        pipeline: {
          id: "pipeline-2",
          name: "Test",
          domainIntegrationId: "di-1",
          steps: [],
        },
      } as unknown as Awaited<ReturnType<typeof getDueSchedules>>[number];
      vi.mocked(getDueSchedules).mockResolvedValue([fakeSchedule]);
      vi.mocked(executeSchedule).mockRejectedValue(
        new Error("Execution failed"),
      );

      const runCheck = () =>
        jobHandlers.check_schedules(
          {},
          new AbortController().signal,
          {} as Parameters<typeof jobHandlers.check_schedules>[2],
        );

      // Act
      await runCheck();

      // Assert
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), scheduleId: "schedule-2" },
        "executeSchedule failed for schedule",
      );
      await expect(Promise.resolve(runCheck())).resolves.not.toThrow();
    });

    it("processes all due schedules and logs only for the one that fails", async () => {
      // Setup
      const scheduleOk = {
        id: "schedule-ok",
        enabled: true,
        nextRunAt: new Date(),
        pipelineId: "p1",
        cronExpression: "0 * * * *",
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
        pipeline: {
          id: "p1",
          name: "Ok",
          domainIntegrationId: "di-1",
          steps: [],
        },
      } as unknown as Awaited<ReturnType<typeof getDueSchedules>>[number];
      const scheduleFail = {
        id: "schedule-fail",
        enabled: true,
        nextRunAt: new Date(),
        pipelineId: "p2",
        cronExpression: "0 * * * *",
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
        pipeline: {
          id: "p2",
          name: "Fail",
          domainIntegrationId: "di-1",
          steps: [],
        },
      } as unknown as Awaited<ReturnType<typeof getDueSchedules>>[number];
      vi.mocked(getDueSchedules).mockResolvedValue([scheduleOk, scheduleFail]);
      vi.mocked(executeSchedule)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Fail"));

      // Act
      await jobHandlers.check_schedules(
        {},
        new AbortController().signal,
        {} as Parameters<typeof jobHandlers.check_schedules>[2],
      );

      // Assert
      expect(executeSchedule).toHaveBeenCalledTimes(2);
      expect(executeSchedule).toHaveBeenNthCalledWith(
        1,
        scheduleOk,
        expect.any(Object),
      );
      expect(executeSchedule).toHaveBeenNthCalledWith(
        2,
        scheduleFail,
        expect.any(Object),
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), scheduleId: "schedule-fail" },
        "executeSchedule failed for schedule",
      );
    });

    it("passes expandStepInputs that rejects when no active domain integration exists", async () => {
      const { prisma } = await import("@hermes/orchestration-database");
      vi.mocked(mockPrisma.domainIntegration.findFirst).mockResolvedValueOnce(
        null,
      );
      const fakeSchedule = {
        id: "schedule-1",
        enabled: true,
        nextRunAt: new Date(),
        pipelineId: "pipeline-1",
        cronExpression: "0 * * * *",
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
        pipeline: {
          id: "pipeline-1",
          name: "Test",
          domainIntegrationId: "di-1",
          executionConfig: null,
          steps: [],
        },
      } as unknown as Awaited<ReturnType<typeof getDueSchedules>>[number];
      vi.mocked(getDueSchedules).mockResolvedValue([fakeSchedule]);
      vi.mocked(executeSchedule).mockImplementation(async (_schedule, deps) => {
        await expect(
          deps.expandStepInputs!({
            input: {},
            scheduleId: "s1",
            pipelineId: "p1",
            pipelineStepId: "st1",
            domainIntegrationId: "di-1",
            orchDb: prisma,
          }),
        ).rejects.toThrow("Domain integration has no base URL");
      });

      await jobHandlers.check_schedules(
        {},
        new AbortController().signal,
        {} as Parameters<typeof jobHandlers.check_schedules>[2],
      );

      expect(executeSchedule).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute_http_trigger", () => {
    it("includes group: { id: pipeline:<pipelineId> } in addJobs for invoke_agent jobs", async () => {
      vi.mocked(executeHttpTrigger).mockImplementation(async (_id, deps) => {
        await deps.enqueueAgentInvocations([
          {
            payload: {
              jobId: "j-ht-1",
              executionId: "e-ht-1",
              httpTriggerExecutionId: "ht-1",
              httpTriggerId: "trigger-1",
              pipelineId: "p-ht",
              pipelineStepId: "st-ht",
              domainIntegrationId: "di-1",
              agentId: "a1",
              agentVersion: "1.0.0",
              endpointUrl: "https://a.example/",
              body: { input: {}, config: {} },
              timeoutMs: 60_000,
              priority: 0,
            },
          },
        ]);
      });

      await jobHandlers.execute_http_trigger(
        { httpTriggerExecutionId: "ht-1" },
        new AbortController().signal,
        {} as Parameters<typeof jobHandlers.execute_http_trigger>[2],
      );

      expect(mockAddJobs).toHaveBeenCalledTimes(1);
      const jobDefs = mockAddJobs.mock.calls[0]![0] as Array<{
        jobType: string;
        group: { id: string };
      }>;
      expect(jobDefs).toHaveLength(1);
      expect(jobDefs[0]).toMatchObject({
        jobType: "invoke_agent",
        group: { id: "pipeline:p-ht" },
      });
    });
  });

  describe("invoke_agent", () => {
    const payload = {
      jobId: "job-1",
      executionId: "exec-1",
      scheduleExecutionId: "se-1",
      scheduleId: "sched-1",
      pipelineId: "pipe-1",
      pipelineStepId: "step-1",
      domainIntegrationId: "di-1",
      agentId: "agent-a",
      agentVersion: "1.0.0",
      endpointUrl: "https://agent.example/run",
      body: { input: { tickerId: "t1" }, config: {} },
      timeoutMs: 60_000,
      priority: 0,
    };

    const signal = new AbortController().signal;
    const jobCtx = {} as JobContext;

    beforeEach(() => {
      vi.mocked(invokeAgentPost).mockClear();
      vi.mocked(parseAgentResponseEnvelope).mockClear();
      vi.mocked(applyInvocationCompletion).mockClear();
      mockPrisma.agentJobExecution.update.mockClear();
      mockPrisma.agentJobExecution.updateMany.mockClear();
      mockPrisma.agentJobExecution.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.scheduleExecution.findUnique.mockResolvedValue({
        cancelledAt: null,
      });
      mockPrisma.httpTriggerExecution.findUnique.mockResolvedValue({
        cancelledAt: null,
      });
      mockPrisma.manualPipelineExecution.findUnique.mockResolvedValue({
        cancelledAt: null,
      });
    });

    it("claims pending row, calls invokeAgentPost, and applies completion on 2xx success envelope", async () => {
      vi.mocked(invokeAgentPost).mockResolvedValue({
        kind: "http",
        response: {
          statusCode: 200,
          rawBody: '{"schemaVersion":1,"status":"success"}',
          isEmptyBody: false,
        },
      });
      vi.mocked(parseAgentResponseEnvelope).mockReturnValue({
        ok: true,
        envelope: {
          schemaVersion: 1,
          status: "success",
          truncated: {},
        },
      });

      await jobHandlers.invoke_agent(payload, signal, jobCtx);

      expect(mockPrisma.agentJobExecution.updateMany).toHaveBeenCalledWith({
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
          startedAt: expect.any(Date),
        },
      });
      expect(invokeAgentPost).toHaveBeenCalledTimes(1);
      expect(invokeAgentPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          jobId: payload.jobId,
          executionId: payload.executionId,
          scheduleId: payload.scheduleId,
          scheduleExecutionId: payload.scheduleExecutionId,
          pipelineStepId: payload.pipelineStepId,
        }),
        expect.anything(),
      );
      expect(applyInvocationCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: payload.jobId,
          scheduleExecutionId: payload.scheduleExecutionId,
          terminal: expect.objectContaining({
            status: AgentJobExecutionStatus.completed,
          }),
        }),
        expect.any(Object),
      );
    });

    it("passes manualExecutionId through invoke and completion for manual pipeline jobs", async () => {
      const manualPayload = {
        ...payload,
        scheduleExecutionId: undefined,
        scheduleId: undefined,
        manualExecutionId: "manual-exec-9",
      };
      vi.mocked(invokeAgentPost).mockResolvedValue({
        kind: "http",
        response: {
          statusCode: 200,
          rawBody: '{"schemaVersion":1,"status":"success"}',
          isEmptyBody: false,
        },
      });
      vi.mocked(parseAgentResponseEnvelope).mockReturnValue({
        ok: true,
        envelope: {
          schemaVersion: 1,
          status: "success",
          truncated: {},
        },
      });

      await jobHandlers.invoke_agent(manualPayload, signal, jobCtx);

      expect(
        mockPrisma.manualPipelineExecution.findUnique,
      ).toHaveBeenCalledWith({
        where: { id: "manual-exec-9" },
        select: { cancelledAt: true },
      });
      expect(invokeAgentPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          manualExecutionId: "manual-exec-9",
          pipelineStepId: manualPayload.pipelineStepId,
        }),
        expect.anything(),
      );
      expect(applyInvocationCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: manualPayload.jobId,
          manualExecutionId: "manual-exec-9",
          terminal: expect.objectContaining({
            status: AgentJobExecutionStatus.completed,
          }),
        }),
        expect.any(Object),
      );
    });

    it("applies cancelled completion and skips HTTP when parent schedule execution is cancelled", async () => {
      mockPrisma.scheduleExecution.findUnique.mockResolvedValueOnce({
        cancelledAt: new Date(),
      });

      await jobHandlers.invoke_agent(payload, signal, jobCtx);

      expect(invokeAgentPost).not.toHaveBeenCalled();
      expect(applyInvocationCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: payload.jobId,
          scheduleExecutionId: payload.scheduleExecutionId,
          terminal: expect.objectContaining({
            status: AgentJobExecutionStatus.cancelled,
          }),
        }),
        expect.any(Object),
      );
    });

    it("syncs DataQueue attempts after claim via idempotency key lookup", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 42, attempts: 2, max_attempts: 5 }],
      });
      vi.mocked(invokeAgentPost).mockResolvedValue({
        kind: "http",
        response: {
          statusCode: 200,
          rawBody: '{"schemaVersion":1,"status":"success"}',
          isEmptyBody: false,
        },
      });
      vi.mocked(parseAgentResponseEnvelope).mockReturnValue({
        ok: true,
        envelope: {
          schemaVersion: 1,
          status: "success",
          truncated: {},
        },
      });

      await jobHandlers.invoke_agent(payload, signal, jobCtx);

      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("idempotency_key"),
        [payload.jobId],
      );
      expect(mockPrisma.agentJobExecution.update).toHaveBeenCalledWith({
        where: { jobId: payload.jobId },
        data: {
          dataQueueAttempts: 2,
          dataQueueMaxAttempts: 5,
        },
      });
    });

    it("updates to failed and rethrows on transport error when DataQueue row is missing", async () => {
      vi.mocked(invokeAgentPost).mockResolvedValue({
        kind: "transport_error",
        error: new Error("Network error"),
      });

      await expect(
        jobHandlers.invoke_agent(payload, signal, jobCtx),
      ).rejects.toThrow("Network error");

      expect(invokeAgentPost).toHaveBeenCalledTimes(1);
      expect(mockPoolQuery).toHaveBeenCalled();
      expect(mockPrisma.agentJobExecution.update).toHaveBeenCalledWith({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.failed,
          error: { message: "Network error", retryable: true },
          completedAt: expect.any(Date),
        },
      });
    });

    it("resets to pending on transport error when DataQueue will retry", async () => {
      vi.mocked(invokeAgentPost).mockResolvedValue({
        kind: "transport_error",
        error: new Error("Network error"),
      });
      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 42, attempts: 1, max_attempts: 3 }],
      });

      await expect(
        jobHandlers.invoke_agent(payload, signal, jobCtx),
      ).rejects.toThrow("Network error");

      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("idempotency_key"),
        [payload.jobId],
      );
      expect(mockPrisma.agentJobExecution.updateMany).toHaveBeenCalledWith({
        where: {
          jobId: payload.jobId,
          status: AgentJobExecutionStatus.running,
        },
        data: {
          status: AgentJobExecutionStatus.pending,
          completedAt: null,
          error: {
            message: "Network error",
            retryable: true,
            transient: true,
          },
        },
      });
      expect(applyInvocationCompletion).not.toHaveBeenCalled();
    });

    it("applies completion and rethrows on transport error when queue attempts are exhausted", async () => {
      vi.mocked(invokeAgentPost).mockResolvedValue({
        kind: "transport_error",
        error: new Error("Network error"),
      });
      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 99, attempts: 3, max_attempts: 3 }],
      });

      await expect(
        jobHandlers.invoke_agent(payload, signal, jobCtx),
      ).rejects.toThrow("Network error");

      expect(applyInvocationCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: payload.jobId,
          scheduleExecutionId: payload.scheduleExecutionId,
          terminal: {
            status: AgentJobExecutionStatus.failed,
            error: { message: "Network error", retryable: true },
          },
        }),
        expect.any(Object),
      );
    });

    it("applies completion on 5xx when queue attempts are exhausted", async () => {
      vi.mocked(invokeAgentPost).mockResolvedValue({
        kind: "http",
        response: {
          statusCode: 503,
          rawBody: "",
          isEmptyBody: true,
        },
      });
      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 7, attempts: 2, max_attempts: 2 }],
      });

      await expect(
        jobHandlers.invoke_agent(payload, signal, jobCtx),
      ).rejects.toThrow("Agent returned HTTP 503");

      expect(applyInvocationCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          terminal: {
            status: AgentJobExecutionStatus.failed,
            error: { message: "Agent HTTP 503", retryable: true },
          },
        }),
        expect.any(Object),
      );
    });

    it("skips HTTP call when claim returns count 0 (idempotent)", async () => {
      mockPrisma.agentJobExecution.updateMany.mockResolvedValue({ count: 0 });

      await jobHandlers.invoke_agent(payload, signal, jobCtx);

      expect(mockPrisma.agentJobExecution.updateMany).toHaveBeenCalledTimes(1);
      expect(invokeAgentPost).not.toHaveBeenCalled();
      expect(mockPrisma.agentJobExecution.update).not.toHaveBeenCalled();
    });

    it("re-claims an already-running row left by a crashed prior attempt (retry path)", async () => {
      // Setup — simulate a prior attempt that crashed: the claim Prisma call
      // must include 'running' so the retry can take over the orphaned row.
      vi.mocked(invokeAgentPost).mockResolvedValue({
        kind: "http",
        response: {
          statusCode: 200,
          rawBody: '{"schemaVersion":1,"status":"success"}',
          isEmptyBody: false,
        },
      });
      vi.mocked(parseAgentResponseEnvelope).mockReturnValue({
        ok: true,
        envelope: { schemaVersion: 1, status: "success", truncated: {} },
      });

      // Act
      await jobHandlers.invoke_agent(payload, signal, jobCtx);

      // Assert — claim where clause must accept both pending AND running
      expect(mockPrisma.agentJobExecution.updateMany).toHaveBeenCalledWith({
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
          startedAt: expect.any(Date),
        },
      });
      expect(invokeAgentPost).toHaveBeenCalledTimes(1);
    });

    it("on 4xx uses JSON body message when present (e.g. agent skipped + message)", async () => {
      vi.mocked(invokeAgentPost).mockResolvedValue({
        kind: "http",
        response: {
          statusCode: 404,
          rawBody: JSON.stringify({
            agentId: "content-generation",
            skipped: true,
            message: "No data sources found for this ticker",
          }),
          isEmptyBody: false,
        },
      });

      await jobHandlers.invoke_agent(payload, signal, jobCtx);

      expect(applyInvocationCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          terminal: {
            status: AgentJobExecutionStatus.failed,
            error: {
              message: "No data sources found for this ticker",
              retryable: false,
            },
          },
        }),
        expect.any(Object),
      );
    });

    it("aborts in-flight invoke and records cancelled when cancelledAt is set mid-flight, clearing the timer", async () => {
      vi.useFakeTimers();
      try {
        // invokeAgentPost resolves with an AbortError when the signal fires
        vi.mocked(invokeAgentPost).mockImplementationOnce(
          (_endpoint, _body, options) => {
            return new Promise((resolve) => {
              options.signal!.addEventListener(
                "abort",
                () => {
                  const err = Object.assign(new Error("AbortError"), {
                    name: "AbortError",
                  });
                  resolve({ kind: "transport_error", error: err });
                },
                { once: true },
              );
            });
          },
        );

        // First call (pre-invoke check): not cancelled yet
        // Second call (poller): cancelled
        mockPrisma.scheduleExecution.findUnique
          .mockResolvedValueOnce({ cancelledAt: null })
          .mockResolvedValueOnce({ cancelledAt: new Date() });

        const handlerPromise = jobHandlers.invoke_agent(
          payload,
          signal,
          jobCtx,
        );

        // Advance past the 3000 ms default poll interval; this fires the poller,
        // which aborts the local controller, which resolves invokeAgentPost.
        await vi.advanceTimersByTimeAsync(3001);

        await handlerPromise;

        expect(vi.getTimerCount()).toBe(0);

        expect(applyInvocationCompletion).toHaveBeenCalledWith(
          expect.objectContaining({
            jobId: payload.jobId,
            scheduleExecutionId: payload.scheduleExecutionId,
            terminal: expect.objectContaining({
              status: AgentJobExecutionStatus.cancelled,
            }),
          }),
          expect.any(Object),
        );

        expect(invokeAgentPost).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("swallows DB errors inside the cancel poller and does not crash the handler", async () => {
      vi.useFakeTimers();
      try {
        // invokeAgentPost resolves normally after the poller fires (but DB error is swallowed)
        let resolveInvoke!: (
          value: Awaited<ReturnType<typeof invokeAgentPost>>,
        ) => void;
        const invokePromise = new Promise<
          Awaited<ReturnType<typeof invokeAgentPost>>
        >((resolve) => {
          resolveInvoke = resolve;
        });
        vi.mocked(invokeAgentPost).mockReturnValueOnce(invokePromise);

        // Poller DB call throws
        mockPrisma.scheduleExecution.findUnique
          .mockResolvedValueOnce({ cancelledAt: null })
          .mockRejectedValueOnce(new Error("DB connection lost"));

        const handlerPromise = jobHandlers.invoke_agent(
          payload,
          signal,
          jobCtx,
        );

        // Fire the poller — DB error should be swallowed, handler keeps running
        await vi.advanceTimersByTimeAsync(3001);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ jobId: payload.jobId }),
          "invoke_agent: cancel poller DB error swallowed",
        );

        // Now let the invoke complete normally
        vi.mocked(parseAgentResponseEnvelope).mockReturnValue({
          ok: true,
          envelope: { schemaVersion: 1, status: "success", truncated: {} },
        });
        resolveInvoke({
          kind: "http",
          response: {
            statusCode: 200,
            rawBody: '{"schemaVersion":1,"status":"success"}',
            isEmptyBody: false,
          },
        });

        await handlerPromise;

        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("resolveDataQueueJob", () => {
    it("returns null when pool is unavailable", async () => {
      const result = await resolveDataQueueJob("missing-job", {
        getPool: () => undefined,
      } as unknown as ReturnType<typeof import("./queue").getJobQueue>);

      expect(result).toBeNull();
    });

    it("returns the first row from idempotency key lookup", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 5, attempts: 1, max_attempts: 3 }],
      });

      const result = await resolveDataQueueJob("job-key");

      expect(result).toEqual({ id: 5, attempts: 1, max_attempts: 3 });
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("idempotency_key"),
        ["job-key"],
      );
    });
  });

  describe("resolveInvokeAgentJobTimeoutMs", () => {
    it("returns agent timeout when below default cap", () => {
      expect(resolveInvokeAgentJobTimeoutMs(60_000)).toBe(60_000);
    });

    it("returns cap when agent timeout exceeds it", () => {
      expect(resolveInvokeAgentJobTimeoutMs(7_200_000, 1_800_000)).toBe(
        1_800_000,
      );
    });
  });

  describe("cleanup_orphaned_executions", () => {
    it("calls cleanupOrphanedExecutions and reconcileOrphanedPendingExecutions and logs combined counts", async () => {
      // Setup
      vi.mocked(cleanupOrphanedExecutions).mockResolvedValue(3);
      vi.mocked(reconcileOrphanedPendingExecutions).mockResolvedValue({
        reEnqueued: 2,
        settled: 1,
      });
      vi.mocked(reconcileZombieExecutions).mockResolvedValue(4);

      // Act
      await jobHandlers.cleanup_orphaned_executions(
        {},
        new AbortController().signal,
        {} as Parameters<typeof jobHandlers.cleanup_orphaned_executions>[2],
      );

      // Assert
      expect(cleanupOrphanedExecutions).toHaveBeenCalledTimes(1);
      expect(cleanupOrphanedExecutions).toHaveBeenCalledWith(
        expect.objectContaining({ db: expect.any(Object) }),
      );
      expect(reconcileOrphanedPendingExecutions).toHaveBeenCalledTimes(1);
      expect(reconcileOrphanedPendingExecutions).toHaveBeenCalledWith(
        expect.objectContaining({
          db: expect.any(Object),
          dataQueuePool: expect.any(Object),
        }),
      );
      expect(reconcileZombieExecutions).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        {
          resolved: 3,
          reEnqueued: 2,
          reconciledSettled: 1,
          zombiesFinalized: 4,
        },
        "cleanup_orphaned_executions: sweep complete",
      );
    });
  });
});
