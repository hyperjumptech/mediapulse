/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAgentRegistryList,
  getPipelineWithSteps,
  getPipelinesWithSteps,
} from "./pipelines";

const createMockDb = () => ({
  pipeline: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  agentRegistry: {
    findMany: vi.fn(),
  },
});

describe("getPipelinesWithSteps", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls pipeline.findMany with include steps and orderBy updatedAt desc", async () => {
    const db = createMockDb() as any;
    db.pipeline.findMany.mockResolvedValue([]);

    await getPipelinesWithSteps(db);

    expect(db.pipeline.findMany).toHaveBeenCalledWith({
      include: { steps: { orderBy: { order: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("returns the result of findMany", async () => {
    const db = createMockDb() as any;
    const pipelines = [
      {
        id: "p1",
        name: "P1",
        steps: [{ id: "s1", order: 0 }],
      },
    ];
    db.pipeline.findMany.mockResolvedValue(pipelines);

    const result = await getPipelinesWithSteps(db);

    expect(result).toEqual(pipelines);
  });
});

describe("getPipelineWithSteps", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls pipeline.findUnique with id and include steps", async () => {
    const db = createMockDb() as any;
    db.pipeline.findUnique.mockResolvedValue(null);

    await getPipelineWithSteps("pid-1", db);

    expect(db.pipeline.findUnique).toHaveBeenCalledWith({
      where: { id: "pid-1" },
      include: { steps: { orderBy: { order: "asc" } } },
    });
  });

  it("returns the result of findUnique", async () => {
    const db = createMockDb() as any;
    const pipeline = { id: "p1", name: "P1", steps: [] };
    db.pipeline.findUnique.mockResolvedValue(pipeline);

    const result = await getPipelineWithSteps("p1", db);

    expect(result).toEqual(pipeline);
  });
});

describe("getAgentRegistryList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls agentRegistry.findMany with isActive true and orderBy", async () => {
    const db = createMockDb() as any;
    db.agentRegistry.findMany.mockResolvedValue([]);

    await getAgentRegistryList(db);

    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ agentId: "asc" }, { agentVersion: "asc" }],
    });
  });

  it("returns the result of findMany", async () => {
    const db = createMockDb() as any;
    const agents = [{ id: "a1", agentId: "ag1", agentVersion: "1" }];
    db.agentRegistry.findMany.mockResolvedValue(agents);

    const result = await getAgentRegistryList(db);

    expect(result).toEqual(agents);
  });
});
