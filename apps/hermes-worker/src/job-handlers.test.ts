/** @vitest-environment node */
import { AgentJobExecutionStatus } from "@workspace/orchestration-database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeSchedule,
  getDueSchedules,
  invokeAgent,
} from "@workspace/hermes-scheduler";
import { logger } from "@workspace/logger";
import { jobHandlers } from "./job-handlers";

const mockPrisma = vi.hoisted(() => ({
  agentJobExecution: {
    update: vi.fn().mockResolvedValue(undefined),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  domainIntegration: {
    findFirst: vi.fn().mockResolvedValue({
      baseUrl: "https://mediapulse-domain.example",
    }),
  },
}));

vi.mock("@workspace/orchestration-database", () => ({
  AgentJobExecutionStatus: {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
  },
  prisma: mockPrisma,
}));

vi.mock("@workspace/env/hermes-worker", () => ({
  env: {
    AGENT_API_KEY: "test-scheduler-key",
    AGENT_AUTH_API_URL: "https://auth.example.com",
    REQUIRE_HTTPS_AGENT_ENDPOINTS: undefined as string | undefined,
    DOMAIN_INTEGRATION_AUTH_TOKEN: "domain-token",
    MEDIAPULSE_API_URL: "https://mediapulse-domain.example",
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

vi.mock("@workspace/hermes-scheduler", () => ({
  getDueSchedules: vi.fn(),
  executeSchedule: vi.fn(),
  invokeAgent: vi.fn(),
}));

const mockAddJobs = vi.fn().mockResolvedValue([1]);

vi.mock("./queue", () => ({
  getJobQueue: () => ({
    addJobs: mockAddJobs,
  }),
}));

describe("jobHandlers", () => {
  beforeEach(() => {
    vi.mocked(getDueSchedules).mockClear();
    vi.mocked(executeSchedule).mockClear();
    vi.mocked(logger.error).mockClear();
    mockAddJobs.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("check_schedules", () => {
    it("calls getDueSchedules with prisma and does not call executeSchedule when no schedules are due", async () => {
      // Setup
      const { prisma } = await import("@workspace/orchestration-database");
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
      const { prisma } = await import("@workspace/orchestration-database");
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
        requireHttpsAgentEndpoints: false,
      });
      const firstCall = vi.mocked(executeSchedule).mock.calls[0];
      const enqueueAgentInvocations = firstCall?.[1]?.enqueueAgentInvocations;
      expect(enqueueAgentInvocations).toBeDefined();
      await enqueueAgentInvocations!([
        {
          jobId: "j1",
          executionId: "e1",
          scheduleId: "s1",
          pipelineId: "p1",
          pipelineStepId: "st1",
          agentId: "a1",
          agentVersion: "1.0.0",
          endpointUrl: "https://a.example/",
          body: { input: {}, config: {} },
          timeoutMs: 60_000,
          priority: 0,
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
      });
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
        pipeline: { id: "p1", name: "Ok", steps: [] },
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
        pipeline: { id: "p2", name: "Fail", steps: [] },
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
  });

  describe("invoke_agent", () => {
    const payload = {
      jobId: "job-1",
      executionId: "exec-1",
      scheduleId: "sched-1",
      pipelineId: "pipe-1",
      pipelineStepId: "step-1",
      agentId: "agent-a",
      agentVersion: "1.0.0",
      endpointUrl: "https://agent.example/run",
      body: { input: { tickerId: "t1" }, config: {} },
      timeoutMs: 60_000,
      priority: 0,
    };

    const signal = new AbortController().signal;
    const ctx = {} as Parameters<typeof jobHandlers.invoke_agent>[2];

    beforeEach(() => {
      vi.mocked(invokeAgent).mockClear();
      mockPrisma.agentJobExecution.update.mockClear();
      mockPrisma.agentJobExecution.updateMany.mockClear();
      mockPrisma.agentJobExecution.updateMany.mockResolvedValue({ count: 1 });
    });

    it("claims pending row, calls invokeAgent with signal, and does not update again on success", async () => {
      vi.mocked(invokeAgent).mockResolvedValue(undefined);

      await jobHandlers.invoke_agent(payload, signal, ctx);

      expect(mockPrisma.agentJobExecution.updateMany).toHaveBeenCalledWith({
        where: {
          jobId: payload.jobId,
          status: AgentJobExecutionStatus.pending,
        },
        data: {
          status: AgentJobExecutionStatus.running,
          startedAt: expect.any(Date),
        },
      });
      expect(invokeAgent).toHaveBeenCalledTimes(1);
      expect(invokeAgent).toHaveBeenCalledWith(
        { url: payload.endpointUrl, method: "POST" },
        payload.body,
        {
          jobId: payload.jobId,
          executionId: payload.executionId,
          authToken: "test-jwt-token",
          timeoutMs: payload.timeoutMs,
          signal,
        },
        expect.any(Object),
      );
      expect(mockPrisma.agentJobExecution.update).not.toHaveBeenCalled();
    });

    it("updates to failed and rethrows when invokeAgent throws", async () => {
      vi.mocked(invokeAgent).mockRejectedValue(new Error("Network error"));

      await expect(
        jobHandlers.invoke_agent(payload, signal, ctx),
      ).rejects.toThrow("Network error");

      expect(invokeAgent).toHaveBeenCalledTimes(1);
      expect(mockPrisma.agentJobExecution.update).toHaveBeenCalledWith({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.failed,
          error: { message: "Network error", retryable: true },
          completedAt: expect.any(Date),
        },
      });
    });

    it("skips HTTP call when claim returns count 0 (idempotent)", async () => {
      mockPrisma.agentJobExecution.updateMany.mockResolvedValue({ count: 0 });

      await jobHandlers.invoke_agent(payload, signal, ctx);

      expect(mockPrisma.agentJobExecution.updateMany).toHaveBeenCalledTimes(1);
      expect(invokeAgent).not.toHaveBeenCalled();
      expect(mockPrisma.agentJobExecution.update).not.toHaveBeenCalled();
    });
  });
});
