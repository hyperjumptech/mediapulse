/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeSchedule, type ExecuteScheduleDeps } from "./execute-schedule";
import type { DueSchedule } from "./get-due-schedules";

const createMockSchedule = (overrides?: Partial<DueSchedule>): DueSchedule =>
  ({
    id: "s1",
    name: "Test",
    repeat: "repeating",
    cronExpression: "0 6 * * *",
    interval: null,
    timezone: "UTC",
    nextRunAt: new Date(),
    pipelineId: "p1",
    params: { tickerId: "tid-1" },
    priority: 0,
    pipeline: {
      id: "p1",
      steps: [
        {
          id: "step1",
          order: 0,
          agentId: "agent-a",
          agentVersion: "1.0.0",
          pipelineId: "p1",
        },
      ],
    },
    ...overrides,
  }) as DueSchedule;

describe("executeSchedule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates schedule execution and updates schedule nextRunAt for repeating", async () => {
    const schedule = createMockSchedule();
    const scheduleUpdate = vi.fn().mockResolvedValue(undefined);
    const scheduleExecutionCreate = vi.fn().mockResolvedValue(undefined);
    const agentRegistryFindMany = vi.fn().mockResolvedValue([
      {
        agentId: "agent-a",
        agentVersion: "1.0.0",
        endpoint: { url: "https://agent.example/run", method: "POST" },
        isActive: true,
      },
    ]);
    const agentJobExecutionCreate = vi.fn().mockResolvedValue(undefined);
    const agentJobExecutionUpdate = vi.fn().mockResolvedValue(undefined);
    const deps: ExecuteScheduleDeps = {
      db: {
        agentRegistry: { findMany: agentRegistryFindMany },
        agentJobExecution: {
          create: agentJobExecutionCreate,
          update: agentJobExecutionUpdate,
        },
        scheduleExecution: { create: scheduleExecutionCreate },
        schedule: { update: scheduleUpdate },
      } as unknown as ExecuteScheduleDeps["db"],
      httpClient: { post: vi.fn().mockResolvedValue(undefined) },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    await executeSchedule(schedule, deps);

    expect(scheduleExecutionCreate).toHaveBeenCalled();
    expect(scheduleUpdate).toHaveBeenCalledTimes(1);
    expect(scheduleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: schedule.id } }),
    );
    const updateCall = scheduleUpdate.mock.calls[0] as [
      { where: { id: string }; data: { nextRunAt?: Date | null } },
    ];
    expect(updateCall[0].data).toHaveProperty("nextRunAt");
  });

  it("disables schedule when repeat is once", async () => {
    const schedule = createMockSchedule({ repeat: "once" });
    const scheduleUpdate = vi.fn().mockResolvedValue(undefined);
    const scheduleExecutionCreate = vi.fn().mockResolvedValue(undefined);
    const agentRegistryFindMany = vi.fn().mockResolvedValue([
      {
        agentId: "agent-a",
        agentVersion: "1.0.0",
        endpoint: { url: "https://agent.example/run", method: "POST" },
        isActive: true,
      },
    ]);
    const deps: ExecuteScheduleDeps = {
      db: {
        agentRegistry: { findMany: agentRegistryFindMany },
        agentJobExecution: {
          create: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
        },
        scheduleExecution: { create: scheduleExecutionCreate },
        schedule: { update: scheduleUpdate },
      } as unknown as ExecuteScheduleDeps["db"],
      httpClient: { post: vi.fn().mockResolvedValue(undefined) },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    await executeSchedule(schedule, deps);

    expect(scheduleUpdate).toHaveBeenCalledWith({
      where: { id: schedule.id },
      data: { enabled: false },
    });
  });
});
