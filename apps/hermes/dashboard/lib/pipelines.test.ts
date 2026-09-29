/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAgentRegistryList, getPipelineWithSteps } from "./pipelines";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

type MockDb = {
  pipeline: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  agentRegistry: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  pipeline: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  agentRegistry: {
    findMany: vi.fn(),
  },
});

const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

const agentRegistryListSelect = {
  id: true,
  agentId: true,
  agentVersion: true,
  description: true,
};

describe("getPipelineWithSteps", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls pipeline.findUnique with id and include steps", async () => {
    const db = createMockDb();
    db.pipeline.findUnique.mockResolvedValue(null);

    await getPipelineWithSteps("pid-1", asDb(db));

    expect(db.pipeline.findUnique).toHaveBeenCalledWith({
      where: { id: "pid-1" },
      include: {
        steps: {
          orderBy: { order: "asc" },
          include: { targetPipeline: { select: { id: true, name: true } } },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  });

  it("returns the result of findUnique", async () => {
    const db = createMockDb();
    const pipeline = { id: "p1", name: "P1", steps: [] };
    db.pipeline.findUnique.mockResolvedValue(pipeline);

    const result = await getPipelineWithSteps("p1", asDb(db));

    expect(result).toEqual(pipeline);
  });
});

describe("getAgentRegistryList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls agentRegistry.findMany with isActive true and orderBy", async () => {
    const db = createMockDb();
    db.agentRegistry.findMany.mockResolvedValue([]);

    await getAgentRegistryList(asDb(db));

    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: agentRegistryListSelect,
      orderBy: [{ agentId: "asc" }, { agentVersion: "asc" }],
    });
  });

  it("filters by domainIntegrationId when provided", async () => {
    const db = createMockDb();
    db.agentRegistry.findMany.mockResolvedValue([]);

    await getAgentRegistryList(asDb(db), "di-1");

    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: { isActive: true, domainIntegrationId: "di-1" },
      select: agentRegistryListSelect,
      orderBy: [{ agentId: "asc" }, { agentVersion: "asc" }],
    });
  });

  it("returns the result of findMany", async () => {
    const db = createMockDb();
    const agents = [{ id: "a1", agentId: "ag1", agentVersion: "1" }];
    db.agentRegistry.findMany.mockResolvedValue(agents);

    const result = await getAgentRegistryList(asDb(db));

    expect(result).toEqual(agents);
  });
});
