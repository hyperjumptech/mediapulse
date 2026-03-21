/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAgentById, getAgentsPage } from "./agents";
import type { PrismaClientWithSchema } from "@workspace/orchestration-database/client";

type MockDb = {
  agentRegistry: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  agentRegistry: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
});

/** Cast minimal mock to PrismaClientWithSchema for tests. */
const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

describe("getAgentsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findMany and count with default sort and no search when options omitted", async () => {
    const db = createMockDb();
    db.agentRegistry.findMany.mockResolvedValue([]);
    db.agentRegistry.count.mockResolvedValue(0);

    await getAgentsPage(1, 10, undefined, asDb(db));

    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { agentId: "asc" },
    });
    expect(db.agentRegistry.count).toHaveBeenCalledWith({ where: undefined });
  });

  it("applies search where clause when search option provided", async () => {
    const db = createMockDb();
    db.agentRegistry.findMany.mockResolvedValue([]);
    db.agentRegistry.count.mockResolvedValue(0);

    await getAgentsPage(1, 5, { search: "foo" }, asDb(db));

    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { agentId: { contains: "foo", mode: "insensitive" } },
          { description: { contains: "foo", mode: "insensitive" } },
        ],
      },
      skip: 0,
      take: 5,
      orderBy: { agentId: "asc" },
    });
    expect(db.agentRegistry.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { agentId: { contains: "foo", mode: "insensitive" } },
          { description: { contains: "foo", mode: "insensitive" } },
        ],
      },
    });
  });

  it("uses sortBy agentVersion and sortDir desc when specified", async () => {
    const db = createMockDb();
    db.agentRegistry.findMany.mockResolvedValue([]);
    db.agentRegistry.count.mockResolvedValue(0);

    await getAgentsPage(
      2,
      15,
      {
        sortBy: "agentVersion",
        sortDir: "desc",
      },
      asDb(db),
    );

    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 15,
      take: 15,
      orderBy: { agentVersion: "desc" },
    });
  });

  it("uses sortBy created when specified", async () => {
    const db = createMockDb();
    db.agentRegistry.findMany.mockResolvedValue([]);
    db.agentRegistry.count.mockResolvedValue(0);

    await getAgentsPage(
      1,
      10,
      { sortBy: "created", sortDir: "desc" },
      asDb(db),
    );

    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { createdAt: "desc" },
    });
  });

  it("uses sortBy updated when specified", async () => {
    const db = createMockDb();
    db.agentRegistry.findMany.mockResolvedValue([]);
    db.agentRegistry.count.mockResolvedValue(0);

    await getAgentsPage(
      1,
      10,
      { sortBy: "updated", sortDir: "desc" },
      asDb(db),
    );

    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { updatedAt: "desc" },
    });
  });

  it("returns agents, total, page, and pageSize", async () => {
    const db = createMockDb();
    const agents = [
      {
        id: "a1",
        agentId: "summarizer",
        agentVersion: "1.0",
        description: null,
        endpoint: {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    db.agentRegistry.findMany.mockResolvedValue(agents);
    db.agentRegistry.count.mockResolvedValue(1);

    const result = await getAgentsPage(1, 10, undefined, asDb(db));

    expect(result).toEqual({
      agents,
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });
});

describe("getAgentById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findUnique with id", async () => {
    const db = createMockDb();
    db.agentRegistry.findUnique.mockResolvedValue(null);

    await getAgentById("agent-uuid-1", asDb(db));

    expect(db.agentRegistry.findUnique).toHaveBeenCalledWith({
      where: { id: "agent-uuid-1" },
    });
  });

  it("returns the agent when found", async () => {
    const db = createMockDb();
    const agent = {
      id: "agent-uuid-1",
      agentId: "summarizer",
      agentVersion: "1.0",
      description: "Test",
      endpoint: { url: "https://example.com" },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.agentRegistry.findUnique.mockResolvedValue(agent);

    const result = await getAgentById("agent-uuid-1", asDb(db));

    expect(result).toEqual(agent);
  });

  it("returns null when not found", async () => {
    const db = createMockDb();
    db.agentRegistry.findUnique.mockResolvedValue(null);

    const result = await getAgentById("missing-id", asDb(db));

    expect(result).toBeNull();
  });
});
