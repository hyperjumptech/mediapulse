/** @vitest-environment node */
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
      domainIntegrationId: "di-1",
      executionConfig: null,
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
      scheduleStepExecution: { create: vi.fn().mockResolvedValue(undefined) },
      agentJobExecution: { create: vi.fn().mockResolvedValue(undefined) },
    };
    return fn(tx);
  });
  return {
    $transaction,
    scheduleExecution: {
      create: scheduleExecutionCreate,
      update: scheduleExecutionUpdate,
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
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
    schedule: { update: vi.fn().mockResolvedValue(undefined) },
    variable: { findMany: vi.fn().mockResolvedValue([]) },
  };
};

describe("executeSchedule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates schedule execution and updates schedule nextRunAt for repeating", async () => {
    const schedule = createMockSchedule();
    const scheduleUpdate = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb();
    db.schedule.update = scheduleUpdate;
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      enqueueAgentInvocations: vi.fn().mockResolvedValue(undefined),
    };

    await executeSchedule(schedule, deps);

    expect(db.$transaction).toHaveBeenCalled();
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
    const now = new Date();
    const schedule = createMockSchedule({
      pipeline: {
        id: "p1",
        domainIntegrationId: "di-1",
        name: "p1",
        description: null,
        isActive: true,
        executionConfig: null,
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

  it("substitutes {{VAR_KEY}} in step input and config and enqueues with resolved values", async () => {
    const now = new Date();
    const schedule = createMockSchedule({
      pipeline: {
        id: "p1",
        domainIntegrationId: "di-1",
        name: "p1",
        description: null,
        isActive: true,
        executionConfig: null,
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

  it("disables schedule when repeat is once", async () => {
    const schedule = createMockSchedule({ repeat: "once" });
    const scheduleUpdate = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb();
    db.schedule.update = scheduleUpdate;
    const deps: ExecuteScheduleDeps = {
      db: db as unknown as ExecuteScheduleDeps["db"],
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
      scheduleExecution: { create: scheduleExecutionCreate, update: vi.fn() },
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
      { data: { errors?: Array<{ message: string }> } },
    ];
    const errors = createCall[0].data.errors ?? [];
    expect(errors.some((e) => e.message.includes("must use HTTPS"))).toBe(true);
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
        isActive: true,
        executionConfig: null,
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
            createdAt: now,
            updatedAt: now,
            agentConfigId: null,
            agentConfig: null,
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
});
