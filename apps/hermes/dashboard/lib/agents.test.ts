/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  agentDomainIntegrationIdInclude,
  getAgentById,
  getAgentRegistryPage,
  getAgentsPage,
} from "./agents";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

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

const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

const agentListSelect = {
  id: true,
  agentId: true,
  agentVersion: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  domainIntegration: { select: { integrationId: true } },
};

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
      select: agentListSelect,
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
      select: agentListSelect,
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
      select: agentListSelect,
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
      select: agentListSelect,
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
      select: agentListSelect,
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
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        domainIntegration: {
          integrationId: "mediapulse-local",
        },
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

describe("getAgentRegistryPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads full registry rows with the default sort for the API", async () => {
    const db = createMockDb();
    const agents = [
      {
        id: "a1",
        domainIntegrationId: "di-1",
        agentId: "summarizer",
        agentVersion: "1.0",
        description: null,
        endpoint: { url: "https://example.com" },
        inputSchema: { type: "object" },
        configSchema: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        domainIntegration: { integrationId: "mediapulse-local" },
      },
    ];
    db.agentRegistry.findMany.mockResolvedValue(agents);
    db.agentRegistry.count.mockResolvedValue(21);

    const result = await getAgentRegistryPage(2, 20, undefined, asDb(db));

    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 20,
      take: 20,
      orderBy: { agentId: "asc" },
      include: agentDomainIntegrationIdInclude,
    });
    expect(db.agentRegistry.count).toHaveBeenCalledWith({ where: undefined });
    expect(result).toEqual({ agents, total: 21, page: 2, pageSize: 20 });
  });

  it("applies search and sort options to the registry query", async () => {
    const db = createMockDb();
    db.agentRegistry.findMany.mockResolvedValue([]);
    db.agentRegistry.count.mockResolvedValue(0);
    const expectedWhere = {
      OR: [
        { agentId: { contains: "summar", mode: "insensitive" } },
        { description: { contains: "summar", mode: "insensitive" } },
      ],
    };

    await getAgentRegistryPage(
      1,
      10,
      { search: "summar", sortBy: "updated", sortDir: "desc" },
      asDb(db),
    );

    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      skip: 0,
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: agentDomainIntegrationIdInclude,
    });
    expect(db.agentRegistry.count).toHaveBeenCalledWith({
      where: expectedWhere,
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
      include: agentDomainIntegrationIdInclude,
    });
  });

  it("returns the agent when found", async () => {
    const db = createMockDb();
    const agent = {
      id: "agent-uuid-1",
      domainIntegrationId: "di-uuid-1",
      agentId: "summarizer",
      agentVersion: "1.0",
      description: "Test",
      endpoint: { url: "https://example.com" },
      inputSchema: null,
      configSchema: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      domainIntegration: {
        integrationId: "mediapulse-local",
      },
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
