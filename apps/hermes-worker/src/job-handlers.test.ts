/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentJobExecutionStatus } from "@workspace/database";
import {
  executeSchedule,
  getDueSchedules,
  invokeAgent,
} from "@workspace/hermes-scheduler";
import { logger } from "@workspace/logger";
import { jobHandlers } from "./job-handlers";

const mockAddJob = vi.hoisted(() => vi.fn().mockResolvedValue(1));
const agentJobExecutionFindUnique = vi.hoisted(() => vi.fn());
const agentJobExecutionUpdate = vi.hoisted(() => vi.fn());

vi.mock("./queue", () => ({
  getJobQueue: () => ({ addJob: mockAddJob }),
}));

vi.mock("@workspace/database", () => ({
  AgentJobExecutionStatus: {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
  },
  prisma: {
    agentJobExecution: {
      findUnique: agentJobExecutionFindUnique,
      update: agentJobExecutionUpdate,
    },
  },
}));

vi.mock("@workspace/env", () => ({
  env: { AGENT_API_KEY: "test-api-key" },
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

describe("jobHandlers", () => {
  beforeEach(() => {
    vi.mocked(getDueSchedules).mockClear();
    vi.mocked(executeSchedule).mockClear();
    vi.mocked(logger.error).mockClear();
    agentJobExecutionFindUnique.mockClear();
    agentJobExecutionUpdate.mockClear();
    vi.mocked(invokeAgent).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("check_schedules", () => {
    it("calls getDueSchedules with prisma and does not call executeSchedule when no schedules are due", async () => {
      // Setup
      const { prisma } = await import("@workspace/database");
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
      const { prisma } = await import("@workspace/database");
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
        httpClient: expect.any(Object),
        logger,
        authToken: "test-api-key",
        defaultTimeoutMs: 300_000,
        enqueueAgentJob: expect.any(Function),
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

  describe("invoke_agent_step", () => {
    const payload = {
      jobId: "job-1",
      executionId: "exec-1",
      scheduleExecutionId: "sexec-1",
      endpoint: { url: "https://agent.example/run", method: "POST" as const },
      body: { input: { tickerId: "t1" }, config: {} },
      timeoutMs: 60_000,
    };
    const signal = new AbortController().signal;
    const ctx = {} as Parameters<typeof jobHandlers.invoke_agent_step>[2];

    it("invokes agent and updates execution to running when status is pending", async () => {
      agentJobExecutionFindUnique.mockResolvedValue({
        jobId: payload.jobId,
        status: AgentJobExecutionStatus.pending,
      });
      agentJobExecutionUpdate.mockResolvedValue(undefined);
      vi.mocked(invokeAgent).mockResolvedValue(undefined);

      await jobHandlers.invoke_agent_step(payload, signal, ctx);

      expect(invokeAgent).toHaveBeenCalledTimes(1);
      expect(invokeAgent).toHaveBeenCalledWith(
        payload.endpoint,
        payload.body,
        {
          jobId: payload.jobId,
          executionId: payload.executionId,
          authToken: "test-api-key",
          timeoutMs: payload.timeoutMs,
        },
        expect.any(Object),
      );
      expect(agentJobExecutionUpdate).toHaveBeenCalledWith({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.running,
          startedAt: expect.any(Date),
        },
      });
    });

    it("skips invoke when execution is already running (idempotent)", async () => {
      agentJobExecutionFindUnique.mockResolvedValue({
        jobId: payload.jobId,
        status: AgentJobExecutionStatus.running,
      });

      await jobHandlers.invoke_agent_step(payload, signal, ctx);

      expect(invokeAgent).not.toHaveBeenCalled();
      expect(agentJobExecutionUpdate).not.toHaveBeenCalled();
    });

    it("skips invoke when execution is already completed (idempotent)", async () => {
      agentJobExecutionFindUnique.mockResolvedValue({
        jobId: payload.jobId,
        status: AgentJobExecutionStatus.completed,
      });

      await jobHandlers.invoke_agent_step(payload, signal, ctx);

      expect(invokeAgent).not.toHaveBeenCalled();
      expect(agentJobExecutionUpdate).not.toHaveBeenCalled();
    });

    it("updates execution to failed and rethrows when invokeAgent throws", async () => {
      agentJobExecutionFindUnique.mockResolvedValue({
        jobId: payload.jobId,
        status: AgentJobExecutionStatus.pending,
      });
      agentJobExecutionUpdate.mockResolvedValue(undefined);
      vi.mocked(invokeAgent).mockRejectedValue(new Error("Network error"));

      await expect(
        jobHandlers.invoke_agent_step(payload, signal, ctx),
      ).rejects.toThrow("Network error");

      expect(agentJobExecutionUpdate).toHaveBeenCalledWith({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.failed,
          error: { message: "Network error", retryable: true },
          completedAt: expect.any(Date),
        },
      });
    });
  });
});
