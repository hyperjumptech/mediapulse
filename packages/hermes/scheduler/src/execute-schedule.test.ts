/** @vitest-environment node */
vi.mock("@hermes/orchestration-database", () => ({
  AgentJobExecutionStatus: {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
    cancelled: "cancelled",
  },
  ScheduleEnqueueStatus: {
    pending: "pending",
    success: "success",
    failed: "failed",
    partial: "partial",
  },
  ScheduleRunStatus: {
    pending: "pending",
    running: "running",
    succeeded: "succeeded",
    failed: "failed",
    partial: "partial",
    cancelled: "cancelled",
  },
  ScheduleStepRollupStatus: {
    pending: "pending",
    running: "running",
    success: "success",
    failed: "failed",
    partial: "partial",
    cancelled: "cancelled",
    skipped: "skipped",
  },
}));

import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSecretVariableValue } from "@hermes/domain-integration-crypto";
import {
  executeSchedule,
  type EnqueueInvokeAgentItem,
  type ExecuteScheduleDeps,
} from "./execute-schedule";
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
    executionConfig: null,
    pipeline: {
      id: "p1",
      name: "Pipeline 1",
      description: null,
      timeout: null,
      isActive: true,
      domainIntegrationId: "di-1",
      executionConfig: null,
      createdById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        {
          id: "step1",
          order: 0,
          agentId: "agent-a",
          agentVersion: "1.0.0",
          pipelineId: "p1",
          agentConfigId: null,
          input: {},
          config: {},
          createdById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          agentConfig: null,
          agentContractId: null,
          agentContract: null,
        },
      ],
    },
    ...overrides,
  }) as DueSchedule;

/** DB mock supporting `$transaction` (jobs path) and direct `scheduleExecution.create` (no-jobs path). */
const createMockDb = (opts?: {
  scheduleExecutionCreate?: ReturnType<typeof vi.fn>;
}) => {
  const scheduleExecutionCreate =
    opts?.scheduleExecutionCreate ?? vi.fn().mockResolvedValue({ id: "se-1" });
  const scheduleExecutionUpdate = vi.fn().mockResolvedValue(undefined);
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      scheduleExecution: { create: scheduleExecutionCreate },
      scheduleStepExecution: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      agentJobExecution: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    return fn(tx);
  });
  return {
    $transaction,
    scheduleExecution: {
      create: scheduleExecutionCreate,
      update: scheduleExecutionUpdate,
      findFirst: vi.fn().mockResolvedValue(null),
    },
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
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    schedule: {
      update: vi.fn().mockResolvedValue(undefined),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    variable: { findMany: vi.fn().mockResolvedValue([]) },
  };
};

describe("executeSchedule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("claims the tick by advancing nextRunAt via a compare-and-swap for repeating", async () => {
    const schedule = createMockSchedule();
    const scheduleUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = createMockDb();
    db.schedule.updateMany = scheduleUpdateMany;
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations: vi.fn().mockResolvedValue(undefined),
    };

    await executeSchedule(schedule, deps);

    expect(db.$transaction).toHaveBeenCalled();
    expect(scheduleUpdateMany).toHaveBeenCalledTimes(1);
    const claimCall = scheduleUpdateMany.mock.calls[0] as [
      {
        where: { id: string; enabled: boolean; nextRunAt: Date | null };
        data: { nextRunAt?: Date | null };
      },
    ];
    expect(claimCall[0].where).toMatchObject({
      id: schedule.id,
      enabled: true,
      nextRunAt: schedule.nextRunAt,
    });
    expect(claimCall[0].data).toHaveProperty("nextRunAt");
  });

  it("bails out without doing work when the tick claim is lost to another worker", async () => {
    const schedule = createMockSchedule();
    const db = createMockDb();
    db.schedule.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger,
      enqueueAgentInvocations,
    };

    await executeSchedule(schedule, deps);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(enqueueAgentInvocations).not.toHaveBeenCalled();
    expect(db.scheduleExecution.findFirst).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleId: schedule.id }),
      "executeSchedule: tick already claimed by another worker — skipping",
    );
  });

  it("enqueues one agent invocation per expanded input with body { input, config }", async () => {
    const now = new Date();
    const schedule = createMockSchedule({
      pipeline: {
        id: "p1",
        domainIntegrationId: "di-1",
        name: "p1",
        description: null,
        timeout: null,
        isActive: true,
        executionConfig: null,
        createdById: null,
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
            createdById: null,
            createdAt: now,
            updatedAt: now,
            agentConfigId: null,
            agentConfig: null,
            agentContractId: null,
            agentContract: null,
          } as DueSchedule["pipeline"]["steps"][number],
        ],
      },
    });
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const deps: ExecuteScheduleDeps = {
      db: createMockDb() as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
    };

    await executeSchedule(schedule, deps);

    expect(enqueueAgentInvocations).toHaveBeenCalledTimes(1);
    const [items] = enqueueAgentInvocations.mock.calls[0] as [
      EnqueueInvokeAgentItem[],
    ];
    expect(items).toHaveLength(1);
    const p = items[0]?.payload;
    expect(p).toBeDefined();
    expect(p!.endpointUrl).toBe("https://agent.example/run");
    expect(p!.body).toEqual({
      input: { tickerId: "tid-1" },
      config: { limit: 10 },
    });
    expect(p!.scheduleExecutionId).toBe("se-1");
  });

  it("uses pipeline.timeout for invoke_agent payload when set", async () => {
    const now = new Date();
    const schedule = createMockSchedule({
      pipeline: {
        id: "p1",
        domainIntegrationId: "di-1",
        name: "p1",
        description: null,
        timeout: 60_000,
        isActive: true,
        executionConfig: null,
        createdById: null,
        createdAt: now,
        updatedAt: now,
        steps: [
          {
            id: "step1",
            order: 0,
            agentId: "agent-a",
            agentVersion: "1.0.0",
            pipelineId: "p1",
            input: {},
            config: {},
            createdById: null,
            createdAt: now,
            updatedAt: now,
            agentConfigId: null,
            agentConfig: null,
            agentContractId: null,
            agentContract: null,
          } as DueSchedule["pipeline"]["steps"][number],
        ],
      },
    });
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const deps: ExecuteScheduleDeps = {
      db: createMockDb() as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
      defaultTimeoutMs: 300_000,
    };

    await executeSchedule(schedule, deps);

    const [items] = enqueueAgentInvocations.mock.calls[0] as [
      EnqueueInvokeAgentItem[],
    ];
    expect(items[0]?.payload.timeoutMs).toBe(60_000);
  });

  it("substitutes {{VAR_KEY}} in step input and config and enqueues with resolved values", async () => {
    const now = new Date();
    const schedule = createMockSchedule({
      pipeline: {
        id: "p1",
        domainIntegrationId: "di-1",
        name: "p1",
        description: null,
        timeout: null,
        isActive: true,
        executionConfig: null,
        createdById: null,
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
            createdById: null,
            createdAt: now,
            updatedAt: now,
            agentConfigId: null,
            agentConfig: null,
            agentContractId: null,
            agentContract: null,
          } as DueSchedule["pipeline"]["steps"][number],
        ],
      },
    });
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const variableFindMany = vi
      .fn()
      .mockResolvedValue([{ key: "MY_KEY", value: "resolved-secret" }]);
    const base = createMockDb();
    base.variable.findMany = variableFindMany;
    const deps: ExecuteScheduleDeps = {
      db: base as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
    };

    await executeSchedule(schedule, deps);

    expect(variableFindMany).toHaveBeenCalled();
    expect(enqueueAgentInvocations).toHaveBeenCalledTimes(1);
    const [items] = enqueueAgentInvocations.mock.calls[0] as [
      EnqueueInvokeAgentItem[],
    ];
    expect(items).toHaveLength(1);
    const p = items[0]?.payload;
    expect(p).toBeDefined();
    expect(p!.body.input).toEqual({ apiKey: "resolved-secret" });
    expect(p!.body.config).toEqual({ token: "resolved-secret" });
  });

  it("clears nextRunAt via the claim when repeat is once", async () => {
    const schedule = createMockSchedule({ repeat: "once" });
    const scheduleUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = createMockDb();
    db.schedule.updateMany = scheduleUpdateMany;
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations: vi.fn().mockResolvedValue(undefined),
    };

    await executeSchedule(schedule, deps);

    expect(scheduleUpdateMany).toHaveBeenCalledWith({
      where: { id: schedule.id, enabled: true, nextRunAt: schedule.nextRunAt },
      data: { nextRunAt: null },
    });
  });

  it("rejects http agent endpoint when requireHttpsAgentEndpoints is true", async () => {
    const schedule = createMockSchedule();
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const scheduleExecutionCreate = vi.fn().mockResolvedValue(undefined);
    const db = {
      ...createMockDb(),
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
      scheduleExecution: {
        create: scheduleExecutionCreate,
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
      requireHttpsAgentEndpoints: true,
    };

    await executeSchedule(schedule, deps);

    expect(enqueueAgentInvocations).not.toHaveBeenCalled();
    expect(scheduleExecutionCreate).toHaveBeenCalledTimes(1);
    const createCall = scheduleExecutionCreate.mock.calls[0] as [
      {
        data: {
          errors?: Array<{ message: string; phase?: string }>;
        };
      },
    ];
    const errors = createCall[0].data.errors ?? [];
    expect(errors.some((e) => e.message.includes("must use HTTPS"))).toBe(true);
    expect(errors.some((e) => e.phase === "planning")).toBe(true);
  });

  it("persists exception stack when enqueueAgentInvocations throws", async () => {
    const schedule = createMockSchedule();
    const queueErr = new Error("queue down");
    queueErr.stack = "Error: queue down\n  at queue.ts:1:1";
    const enqueueAgentInvocations = vi.fn().mockRejectedValue(queueErr);
    const scheduleExecutionUpdate = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb();
    db.scheduleExecution.update = scheduleExecutionUpdate;
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
    };

    await executeSchedule(schedule, deps);

    expect(scheduleExecutionUpdate).toHaveBeenCalled();
    const updateArg = scheduleExecutionUpdate.mock.calls[0]?.[0] as {
      data: {
        errors?: Array<{ phase?: string; exception?: { stack?: string } }>;
      };
    };
    const persisted = updateArg.data.errors ?? [];
    expect(
      persisted.some(
        (e) =>
          e.phase === "enqueue" &&
          e.exception?.stack != null &&
          e.exception.stack.includes("queue.ts"),
      ),
    ).toBe(true);
  });

  it("allows http localhost when requireHttpsAgentEndpoints is true", async () => {
    const schedule = createMockSchedule();
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const db = {
      ...createMockDb(),
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
    };
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
      requireHttpsAgentEndpoints: true,
    };

    await executeSchedule(schedule, deps);

    expect(enqueueAgentInvocations).toHaveBeenCalledTimes(1);
    const [items] = enqueueAgentInvocations.mock.calls[0] as [
      EnqueueInvokeAgentItem[],
    ];
    expect(items).toHaveLength(1);
    const p = items[0]?.payload;
    expect(p).toBeDefined();
    expect(p!.endpointUrl).toBe("http://localhost:4010/");
  });

  it("throws when secret variable decryption key is missing", async () => {
    // Setup
    const schedule = createMockSchedule();
    const encryptedLikePayload =
      '{"v":1,"iv":"aXY","ciphertext":"Y2lwaGVydGV4dA","tag":"dGFn"}';
    const db = createMockDb();
    db.variable.findMany = vi.fn().mockResolvedValue([
      {
        key: "SECRET",
        value: "",
        isSecret: true,
        encryptedPayload: { ciphertext: encryptedLikePayload },
      },
    ]);
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations: vi.fn().mockResolvedValue(undefined),
    };

    // Act & Assert
    await expect(executeSchedule(schedule, deps)).rejects.toThrow(
      "Secret variable substitution requires variableSecretMasterKey",
    );
  });

  it("decrypts encrypted secret variables before substituting into agent payload", async () => {
    // Setup
    const now = new Date();
    const masterKey = "k".repeat(32);
    const encryptedSecret = encryptSecretVariableValue(
      "resolved-secret",
      masterKey,
    );
    const schedule = createMockSchedule({
      pipeline: {
        id: "p1",
        domainIntegrationId: "di-1",
        name: "p1",
        description: null,
        timeout: null,
        isActive: true,
        executionConfig: null,
        createdById: null,
        createdAt: now,
        updatedAt: now,
        steps: [
          {
            id: "step1",
            order: 0,
            agentId: "agent-a",
            agentVersion: "1.0.0",
            pipelineId: "p1",
            input: { apiKey: "{{SECRET}}" },
            config: { token: "{{SECRET}}" },
            createdById: null,
            createdAt: now,
            updatedAt: now,
            agentConfigId: null,
            agentConfig: null,
            agentContractId: null,
            agentContract: null,
          } as DueSchedule["pipeline"]["steps"][number],
        ],
      },
    });
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb();
    db.variable.findMany = vi.fn().mockResolvedValue([
      {
        key: "SECRET",
        value: "",
        isSecret: true,
        encryptedPayload: { ciphertext: encryptedSecret },
      },
    ]);
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
      variableSecretMasterKey: masterKey,
    };

    // Act
    await executeSchedule(schedule, deps);

    // Assert
    expect(enqueueAgentInvocations).toHaveBeenCalledTimes(1);
    const [items] = enqueueAgentInvocations.mock.calls[0] as [
      EnqueueInvokeAgentItem[],
    ];
    expect(items).toHaveLength(1);
    const payload = items[0]?.payload;
    expect(payload).toBeDefined();
    expect(payload!.body.input).toEqual({ apiKey: "resolved-secret" });
    expect(payload!.body.config).toEqual({ token: "resolved-secret" });
  });

  it("persists a large fan-out in a single createMany call with no per-row creates", async () => {
    const FAN_OUT = 1000;
    const schedule = createMockSchedule();

    let capturedTx: {
      agentJobExecution: {
        createMany: ReturnType<typeof vi.fn>;
        create?: ReturnType<typeof vi.fn>;
      };
      scheduleStepExecution: {
        createMany: ReturnType<typeof vi.fn>;
        create?: ReturnType<typeof vi.fn>;
      };
    } | null = null;

    const agentJobExecutionCreateMany = vi
      .fn()
      .mockResolvedValue({ count: FAN_OUT });
    const scheduleStepExecutionCreateMany = vi
      .fn()
      .mockResolvedValue({ count: 1 });

    const db = {
      ...createMockDb(),
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          scheduleExecution: {
            create: vi.fn().mockResolvedValue({ id: "se-regression" }),
          },
          scheduleStepExecution: {
            createMany: scheduleStepExecutionCreateMany,
          },
          agentJobExecution: { createMany: agentJobExecutionCreateMany },
        };
        capturedTx = tx;

        return fn(tx);
      }),
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
    };

    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations,
      expandStepInputs: async () =>
        Array.from({ length: FAN_OUT }, (_, index) => ({
          id: `item-${index}`,
        })),
    };

    await executeSchedule(schedule, deps);

    expect(capturedTx).not.toBeNull();
    expect(capturedTx!.agentJobExecution.createMany).toHaveBeenCalledTimes(1);
    const createManyArg = capturedTx!.agentJobExecution.createMany.mock
      .calls[0]?.[0] as {
      data: unknown[];
    };
    expect(createManyArg.data).toHaveLength(FAN_OUT);
    expect(capturedTx!.agentJobExecution.create).toBeUndefined();

    expect(enqueueAgentInvocations).toHaveBeenCalledTimes(1);
    const [items] = enqueueAgentInvocations.mock.calls[0] as [
      EnqueueInvokeAgentItem[],
    ];
    expect(items).toHaveLength(FAN_OUT);
    expect(
      items.every(
        (item) => item.payload.scheduleExecutionId === "se-regression",
      ),
    ).toBe(true);
  });

  it("skips execution but still claims the tick when a non-terminal execution already exists", async () => {
    const schedule = createMockSchedule();
    const scheduleUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = createMockDb();
    db.schedule.updateMany = scheduleUpdateMany;
    db.scheduleExecution.findFirst = vi
      .fn()
      .mockResolvedValue({ id: "se-running", runStatus: "running" });

    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger,
      enqueueAgentInvocations,
    };

    await executeSchedule(schedule, deps);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(enqueueAgentInvocations).not.toHaveBeenCalled();
    expect(scheduleUpdateMany).toHaveBeenCalledTimes(1);
    expect(scheduleUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: schedule.id }),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: schedule.id,
        existingExecutionId: "se-running",
        existingRunStatus: "running",
      }),
      "executeSchedule: skipping tick — prior execution is still non-terminal",
    );
  });
});
