/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSchedule, getDueSchedules } from "@workspace/hermes-scheduler";
import { logger } from "@workspace/logger";
import { jobHandlers } from "./job-handlers";

vi.mock("@workspace/database", () => ({
  prisma: {},
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
}));

describe("jobHandlers", () => {
  beforeEach(() => {
    vi.mocked(getDueSchedules).mockClear();
    vi.mocked(executeSchedule).mockClear();
    vi.mocked(logger.error).mockClear();
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
});
