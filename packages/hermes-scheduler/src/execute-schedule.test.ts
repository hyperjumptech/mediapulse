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
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const deps: ExecuteScheduleDeps = {
      db: {
        agentRegistry: { findMany: agentRegistryFindMany },
        agentJobExecution: {
          create: agentJobExecutionCreate,
          update: vi.fn().mockResolvedValue(undefined),
        },
        scheduleExecution: { create: scheduleExecutionCreate },
        schedule: { update: scheduleUpdate },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
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

  it("enqueues one agent invocation per expanded input with body { input, config }", async () => {
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
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
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
        scheduleExecution: { create: vi.fn().mockResolvedValue(undefined) },
        schedule: { update: vi.fn().mockResolvedValue(undefined) },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
    };

    // Act
    await executeSchedule(schedule, deps);

    // Assert
    expect(enqueueAgentInvocations).toHaveBeenCalledTimes(1);
    const [payloads] = enqueueAgentInvocations.mock.calls[0] as [
      import("./execute-schedule").InvokeAgentJobPayload[],
    ];
    expect(payloads).toHaveLength(1);
    const p = payloads[0];
    expect(p).toBeDefined();
    expect(p!.endpointUrl).toBe("https://agent.example/run");
    expect(p!.body).toEqual({
      input: { tickerId: "tid-1" },
      config: { limit: 10 },
    });
  });

  it("substitutes {{VAR_KEY}} in step input and config and enqueues with resolved values", async () => {
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
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
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
        scheduleExecution: { create: vi.fn().mockResolvedValue(undefined) },
        schedule: { update: vi.fn().mockResolvedValue(undefined) },
        variable: { findMany: variableFindMany },
      } as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
    };

    await executeSchedule(schedule, deps);

    expect(variableFindMany).toHaveBeenCalled();
    expect(enqueueAgentInvocations).toHaveBeenCalledTimes(1);
    const [payloads] = enqueueAgentInvocations.mock.calls[0] as [
      import("./execute-schedule").InvokeAgentJobPayload[],
    ];
    expect(payloads).toHaveLength(1);
    const p = payloads[0];
    expect(p).toBeDefined();
    expect(p!.body.input).toEqual({ apiKey: "resolved-secret" });
    expect(p!.body.config).toEqual({ token: "resolved-secret" });
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
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations: vi.fn().mockResolvedValue(undefined),
    };

    await executeSchedule(schedule, deps);

    expect(scheduleUpdate).toHaveBeenCalledWith({
      where: { id: schedule.id },
      data: { enabled: false },
    });
  });

  it("rejects http agent endpoint when requireHttpsAgentEndpoints is true", async () => {
    const schedule = createMockSchedule();
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const scheduleExecutionCreate = vi.fn().mockResolvedValue(undefined);
    const deps: ExecuteScheduleDeps = {
      db: {
        agentRegistry: {
          findMany: vi.fn().mockResolvedValue([
            {
              agentId: "agent-a",
              agentVersion: "1.0.0",
              endpoint: { url: "http://evil.example/run", method: "POST" },
              isActive: true,
            },
          ]),
        },
        agentJobExecution: {
          create: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
        },
        scheduleExecution: { create: scheduleExecutionCreate },
        schedule: { update: vi.fn().mockResolvedValue(undefined) },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
      requireHttpsAgentEndpoints: true,
    };

    await executeSchedule(schedule, deps);

    expect(enqueueAgentInvocations).not.toHaveBeenCalled();
    expect(scheduleExecutionCreate).toHaveBeenCalledTimes(1);
    const createCall = scheduleExecutionCreate.mock.calls[0] as [
      { data: { errors?: Array<{ message: string }> } },
    ];
    const errors = createCall[0].data.errors ?? [];
    expect(errors.some((e) => e.message.includes("must use HTTPS"))).toBe(true);
  });

  it("allows http localhost when requireHttpsAgentEndpoints is true", async () => {
    const schedule = createMockSchedule();
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const deps: ExecuteScheduleDeps = {
      db: {
        agentRegistry: {
          findMany: vi.fn().mockResolvedValue([
            {
              agentId: "agent-a",
              agentVersion: "1.0.0",
              endpoint: {
                url: "http://localhost:4010/",
                method: "POST",
              },
              isActive: true,
            },
          ]),
        },
        agentJobExecution: {
          create: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
        },
        scheduleExecution: { create: vi.fn().mockResolvedValue(undefined) },
        schedule: { update: vi.fn().mockResolvedValue(undefined) },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
      requireHttpsAgentEndpoints: true,
    };

    await executeSchedule(schedule, deps);

    expect(enqueueAgentInvocations).toHaveBeenCalledTimes(1);
    const [payloads] = enqueueAgentInvocations.mock.calls[0] as [
      import("./execute-schedule").InvokeAgentJobPayload[],
    ];
    expect(payloads).toHaveLength(1);
    const p = payloads[0];
    expect(p).toBeDefined();
    expect(p!.endpointUrl).toBe("http://localhost:4010/");
  });
});
