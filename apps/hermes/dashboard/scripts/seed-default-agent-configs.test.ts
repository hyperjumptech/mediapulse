/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

import {
  seedDefaultAgentConfigs,
  upsertAgentConfig,
} from "./seed-default-agent-configs";

type MockAgentConfigDb = {
  agentConfig: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockAgentConfigDb => ({
  agentConfig: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
});

const asDb = (db: MockAgentConfigDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

describe("upsertAgentConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a new AgentConfig row when none exists and returns true", async () => {
    // Setup
    const db = createMockDb();
    db.agentConfig.findFirst.mockResolvedValue(null);
    db.agentConfig.create.mockResolvedValue({ id: "new-id" });

    // Act
    const wasCreated = await upsertAgentConfig(asDb(db), {
      agentId: "analysis",
      agentVersion: "1.0.0",
      name: "Default",
      description: "Test config",
      config: { relevanceMinScore: 0.3 },
    });

    // Assert
    expect(wasCreated).toBe(true);
    expect(db.agentConfig.create).toHaveBeenCalledWith({
      data: {
        agentId: "analysis",
        agentVersion: "1.0.0",
        name: "Default",
        description: "Test config",
        config: { relevanceMinScore: 0.3 },
      },
    });
    expect(db.agentConfig.update).not.toHaveBeenCalled();
  });

  it("updates an existing AgentConfig row when one exists and returns false", async () => {
    // Setup
    const db = createMockDb();
    db.agentConfig.findFirst.mockResolvedValue({ id: "existing-id" });
    db.agentConfig.update.mockResolvedValue({ id: "existing-id" });

    // Act
    const wasCreated = await upsertAgentConfig(asDb(db), {
      agentId: "content-generation",
      agentVersion: "1.0.0",
      name: "Default",
      description: "Updated config",
      config: { output: { topNewsCount: 5 } },
    });

    // Assert
    expect(wasCreated).toBe(false);
    expect(db.agentConfig.update).toHaveBeenCalledWith({
      where: { id: "existing-id" },
      data: {
        description: "Updated config",
        config: { output: { topNewsCount: 5 } },
      },
    });
    expect(db.agentConfig.create).not.toHaveBeenCalled();
  });

  it("scopes lookup to agentId, agentVersion, and name", async () => {
    // Setup
    const db = createMockDb();
    db.agentConfig.findFirst.mockResolvedValue(null);
    db.agentConfig.create.mockResolvedValue({ id: "id-1" });

    // Act
    await upsertAgentConfig(asDb(db), {
      agentId: "analysis",
      agentVersion: "2.0.0",
      name: "Staging",
      description: "desc",
      config: {},
    });

    // Assert
    expect(db.agentConfig.findFirst).toHaveBeenCalledWith({
      where: {
        agentId: "analysis",
        agentVersion: "2.0.0",
        name: "Staging",
      },
      select: { id: true },
    });
  });
});

describe("seedDefaultAgentConfigs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates both configs when neither exists", async () => {
    // Setup
    const db = createMockDb();
    db.agentConfig.findFirst.mockResolvedValue(null);
    db.agentConfig.create.mockResolvedValue({ id: "new-id" });

    // Act
    const result = await seedDefaultAgentConfigs(asDb(db));

    // Assert
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(db.agentConfig.create).toHaveBeenCalledTimes(2);
  });

  it("updates both configs when both already exist", async () => {
    // Setup
    const db = createMockDb();
    db.agentConfig.findFirst.mockResolvedValue({ id: "existing-id" });
    db.agentConfig.update.mockResolvedValue({ id: "existing-id" });

    // Act
    const result = await seedDefaultAgentConfigs(asDb(db));

    // Assert
    expect(result.created).toBe(0);
    expect(result.updated).toBe(2);
    expect(db.agentConfig.update).toHaveBeenCalledTimes(2);
  });

  it("seeds analysis config with rebalanced weights and lower minimum score", async () => {
    // Setup
    const db = createMockDb();
    db.agentConfig.findFirst.mockResolvedValue(null);
    db.agentConfig.create.mockResolvedValue({ id: "id" });

    // Act
    await seedDefaultAgentConfigs(asDb(db));

    // Assert — find the analysis create call
    const analysisCalls = vi.mocked(db.agentConfig.create).mock.calls;
    const analysisCall = analysisCalls.find(
      (call) => call[0]?.data?.agentId === "analysis",
    );
    expect(analysisCall).toBeDefined();
    const cfg = analysisCall![0]?.data?.config as Record<string, unknown>;
    expect(cfg.relevanceWeightFundamental).toBe(0.3);
    expect(cfg.relevanceWeightTickerSalience).toBe(0.3);
    expect(cfg.relevanceMinScore).toBe(0.3);
  });

  it("seeds content-generation config with topNewsCount 5", async () => {
    // Setup
    const db = createMockDb();
    db.agentConfig.findFirst.mockResolvedValue(null);
    db.agentConfig.create.mockResolvedValue({ id: "id" });

    // Act
    await seedDefaultAgentConfigs(asDb(db));

    // Assert — find the content-generation create call
    const cgCalls = vi.mocked(db.agentConfig.create).mock.calls;
    const cgCall = cgCalls.find(
      (call) => call[0]?.data?.agentId === "content-generation",
    );
    expect(cgCall).toBeDefined();
    const cfg = cgCall![0]?.data?.config as Record<string, unknown>;
    const output = cfg.output as Record<string, unknown>;
    expect(output.topNewsCount).toBe(5);
  });
});
