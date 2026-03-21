/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

import { seedKgPipelines } from "./seed-kg-pipelines";

type MockDb = {
  agentRegistry: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  pipeline: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  pipelineStep: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  schedule: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

const createCreateModeDb = (): MockDb => {
  let pipelineCounter = 0;
  return {
    agentRegistry: {
      findFirst: vi.fn().mockResolvedValue({ id: "agent-row" }),
    },
    pipeline: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async () => {
        pipelineCounter += 1;
        return { id: `pipeline-${pipelineCounter}` };
      }),
      update: vi.fn(),
    },
    pipelineStep: {
      upsert: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    schedule: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "schedule-created" }),
      update: vi.fn(),
    },
  };
};

const createUpdateModeDb = (): MockDb => ({
  agentRegistry: {
    findFirst: vi.fn().mockResolvedValue({ id: "agent-row" }),
  },
  pipeline: {
    findFirst: vi.fn().mockImplementation(async ({ where }) => ({
      id: `existing-${where.name as string}`,
    })),
    create: vi.fn(),
    update: vi.fn().mockImplementation(async ({ where }) => ({
      id: where.id as string,
    })),
  },
  pipelineStep: {
    upsert: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  schedule: {
    findFirst: vi.fn().mockImplementation(async ({ where }) => ({
      id: `existing-schedule-${where.name as string}`,
    })),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({ id: "schedule-updated" }),
  },
});

describe("seedKgPipelines", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates all three pipelines, five steps, and three disabled schedules", async () => {
    // Setup
    const db = createCreateModeDb();
    const computeNextRunAt = vi
      .fn()
      .mockReturnValue(new Date("2026-03-19T00:00:00.000Z"));

    // Act
    const result = await seedKgPipelines(asDb(db), computeNextRunAt);

    // Assert
    expect(result).toEqual({
      pipelinesSeeded: 3,
      stepsSeeded: 5,
      schedulesSeeded: 3,
    });
    expect(db.agentRegistry.findFirst).toHaveBeenCalledTimes(5);
    expect(db.pipeline.create).toHaveBeenCalledTimes(3);
    expect(db.pipeline.update).not.toHaveBeenCalled();
    expect(db.pipelineStep.upsert).toHaveBeenCalledTimes(5);
    expect(db.pipelineStep.deleteMany).toHaveBeenCalledTimes(3);
    expect(db.schedule.create).toHaveBeenCalledTimes(3);
    expect(db.schedule.update).not.toHaveBeenCalled();

    for (const call of db.pipelineStep.upsert.mock.calls) {
      const payload = call[0] as {
        create: { input: { tickerId: string } };
        update: { input: { tickerId: string } };
      };
      expect(payload.create.input.tickerId).toBe(
        "db:userTicker:tickerId?where.enabled=true",
      );
      expect(payload.update.input.tickerId).toBe(
        "db:userTicker:tickerId?where.enabled=true",
      );
    }

    expect(db.schedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Daily Query Analysis",
          cronExpression: "0 5 * * *",
          timezone: "Asia/Jakarta",
          repeat: "repeating",
          enabled: false,
        }),
      }),
    );
    expect(db.schedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "4x Daily Data Collection",
          cronExpression: "0 6,10,14,18 * * *",
          timezone: "Asia/Jakarta",
          repeat: "repeating",
          enabled: false,
        }),
      }),
    );
    expect(db.schedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Daily Newsletter",
          cronExpression: "0 20 * * *",
          timezone: "Asia/Jakarta",
          repeat: "repeating",
          enabled: false,
        }),
      }),
    );
  });

  it("updates existing pipelines and schedules to keep seeding idempotent", async () => {
    // Setup
    const db = createUpdateModeDb();
    const computeNextRunAt = vi
      .fn()
      .mockReturnValue(new Date("2026-03-19T00:00:00.000Z"));

    // Act
    await seedKgPipelines(asDb(db), computeNextRunAt);

    // Assert
    expect(db.pipeline.create).not.toHaveBeenCalled();
    expect(db.pipeline.update).toHaveBeenCalledTimes(3);
    expect(db.schedule.create).not.toHaveBeenCalled();
    expect(db.schedule.update).toHaveBeenCalledTimes(3);
  });

  it("throws when a required agent is missing from registry", async () => {
    // Setup
    const db = createCreateModeDb();
    db.agentRegistry.findFirst.mockResolvedValueOnce(null);
    const computeNextRunAt = vi
      .fn()
      .mockReturnValue(new Date("2026-03-19T00:00:00.000Z"));

    // Act & Assert
    await expect(seedKgPipelines(asDb(db), computeNextRunAt)).rejects.toThrow(
      "Missing active agent registry entry for query-analysis@1.0.0",
    );
  });
});
