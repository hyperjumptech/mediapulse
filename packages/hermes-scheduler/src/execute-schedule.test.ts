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
          agentConfigId: null,
          input: {},
          agentConfig: null,
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
    const scheduleExecutionCreate = vi.fn().mockResolvedValue({ id: "exec-1" });
    const scheduleExecutionUpdate = vi.fn().mockResolvedValue(undefined);
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
        scheduleExecution: {
          create: scheduleExecutionCreate,
          update: scheduleExecutionUpdate,
        },
        schedule: { update: scheduleUpdate },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as ExecuteScheduleDeps["db"],
      httpClient: { post: vi.fn().mockResolvedValue(undefined) },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    await executeSchedule(schedule, deps);

    expect(scheduleExecutionCreate).toHaveBeenCalledTimes(1);
    expect(scheduleExecutionUpdate).toHaveBeenCalledTimes(1);
    expect(scheduleUpdate).toHaveBeenCalledTimes(1);
    expect(scheduleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: schedule.id } }),
    );
    const updateCall = scheduleUpdate.mock.calls[0] as [
      { where: { id: string }; data: { nextRunAt?: Date | null } },
    ];
    expect(updateCall[0].data).toHaveProperty("nextRunAt");
  });

  it("sends body { input, config } to agent with step config when present", async () => {
    // Setup
    const now = new Date();
    const schedule = createMockSchedule({
      pipeline: {
        id: "p1",
        name: "p1",
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        steps: [
          {
            id: "step1",
            order: 0,
            agentId: "agent-a",
            agentVersion: "1.0.0",
            pipelineId: "p1",
            input: { tickerId: "tid-1" },
            config: { limit: 10 },
            createdAt: now,
            updatedAt: now,
            agentConfigId: null,
            agentConfig: null,
          } as DueSchedule["pipeline"]["steps"][number],
        ],
      },
    });
    const post = vi.fn().mockResolvedValue(undefined);
    const deps: ExecuteScheduleDeps = {
      db: {
        agentRegistry: {
          findMany: vi.fn().mockResolvedValue([
            {
              agentId: "agent-a",
              agentVersion: "1.0.0",
              endpoint: { url: "https://agent.example/run", method: "POST" },
              isActive: true,
            },
          ]),
        },
        agentJobExecution: {
          create: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
        },
        scheduleExecution: {
          create: vi.fn().mockResolvedValue({ id: "exec-1" }),
          update: vi.fn().mockResolvedValue(undefined),
        },
        schedule: { update: vi.fn().mockResolvedValue(undefined) },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as ExecuteScheduleDeps["db"],
      httpClient: { post },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    // Act
    await executeSchedule(schedule, deps);

    // Assert
    expect(post).toHaveBeenCalledTimes(1);
    const [url, options] = post.mock.calls[0] as [
      string,
      { json: Record<string, unknown> },
    ];
    expect(url).toBe("https://agent.example/run");
    expect(options.json).toEqual({
      input: { tickerId: "tid-1" },
      config: { limit: 10 },
    });
  });

  it("substitutes {{VAR_KEY}} in step input and config with variable values", async () => {
    const now = new Date();
    const schedule = createMockSchedule({
      pipeline: {
        id: "p1",
        name: "p1",
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        steps: [
          {
            id: "step1",
            order: 0,
            agentId: "agent-a",
            agentVersion: "1.0.0",
            pipelineId: "p1",
            input: { apiKey: "{{MY_KEY}}" },
            config: { token: "{{MY_KEY}}" },
            createdAt: now,
            updatedAt: now,
            agentConfigId: null,
            agentConfig: null,
          } as DueSchedule["pipeline"]["steps"][number],
        ],
      },
    });
    const post = vi.fn().mockResolvedValue(undefined);
    const variableFindMany = vi
      .fn()
      .mockResolvedValue([{ key: "MY_KEY", value: "resolved-secret" }]);
    const deps: ExecuteScheduleDeps = {
      db: {
        agentRegistry: {
          findMany: vi.fn().mockResolvedValue([
            {
              agentId: "agent-a",
              agentVersion: "1.0.0",
              endpoint: { url: "https://agent.example/run", method: "POST" },
              isActive: true,
            },
          ]),
        },
        agentJobExecution: {
          create: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
        },
        scheduleExecution: {
          create: vi.fn().mockResolvedValue({ id: "exec-1" }),
          update: vi.fn().mockResolvedValue(undefined),
        },
        schedule: { update: vi.fn().mockResolvedValue(undefined) },
        variable: { findMany: variableFindMany },
      } as unknown as ExecuteScheduleDeps["db"],
      httpClient: { post },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    await executeSchedule(schedule, deps);

    expect(variableFindMany).toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(1);
    const [, options] = post.mock.calls[0] as [
      string,
      {
        json: {
          input: Record<string, unknown>;
          config: Record<string, unknown>;
        };
      },
    ];
    expect(options.json.input).toEqual({ apiKey: "resolved-secret" });
    expect(options.json.config).toEqual({ token: "resolved-secret" });
  });

  it("disables schedule when repeat is once", async () => {
    const schedule = createMockSchedule({ repeat: "once" });
    const scheduleUpdate = vi.fn().mockResolvedValue(undefined);
    const scheduleExecutionCreate = vi.fn().mockResolvedValue({ id: "exec-1" });
    const scheduleExecutionUpdate = vi.fn().mockResolvedValue(undefined);
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
        scheduleExecution: {
          create: scheduleExecutionCreate,
          update: scheduleExecutionUpdate,
        },
        schedule: { update: scheduleUpdate },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
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

  it("calls enqueueAgentJob once per input set and does not invoke agent inline", async () => {
    const schedule = createMockSchedule();
    const enqueueAgentJob = vi.fn().mockResolvedValue(undefined);
    const post = vi.fn();
    const deps: ExecuteScheduleDeps = {
      db: {
        agentRegistry: {
          findMany: vi.fn().mockResolvedValue([
            {
              agentId: "agent-a",
              agentVersion: "1.0.0",
              endpoint: { url: "https://agent.example/run", method: "POST" },
              isActive: true,
            },
          ]),
        },
        agentJobExecution: {
          create: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
        },
        scheduleExecution: {
          create: vi.fn().mockResolvedValue({ id: "exec-1" }),
          update: vi.fn().mockResolvedValue(undefined),
        },
        schedule: { update: vi.fn().mockResolvedValue(undefined) },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as ExecuteScheduleDeps["db"],
      httpClient: { post },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentJob,
    };

    await executeSchedule(schedule, deps);

    expect(post).not.toHaveBeenCalled();
    expect(enqueueAgentJob).toHaveBeenCalledTimes(1);
    const [payload] = enqueueAgentJob.mock.calls[0] as [
      import("./execute-schedule").InvokeAgentStepPayload,
    ];
    expect(payload).toMatchObject({
      scheduleExecutionId: "exec-1",
      endpoint: { url: "https://agent.example/run", method: "POST" },
      body: { input: {}, config: {} },
    });
    expect(payload.jobId).toBeDefined();
    expect(payload.executionId).toBeDefined();
    expect(typeof payload.timeoutMs).toBe("number");
  });
});
