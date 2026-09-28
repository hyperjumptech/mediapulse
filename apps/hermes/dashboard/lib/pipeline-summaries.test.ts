/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPipelineListItemsPage,
  getPipelineSummariesPage,
  type PipelineListItemsDb,
  type PipelineSummariesDb,
  type PipelineSummariesQuery,
} from "./pipeline-summaries";
import { getPipelinesValidationMap } from "./validate-pipeline";

vi.mock("./validate-pipeline", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, getPipelinesValidationMap: vi.fn() };
});

const getPipelinesValidationMapMock = vi.mocked(getPipelinesValidationMap);

const createDb = () => ({
  pipeline: { findMany: vi.fn(), count: vi.fn() },
  agentRegistry: { findMany: vi.fn() },
  agentConfig: { findMany: vi.fn() },
});

const asSummariesDb = (db: ReturnType<typeof createDb>): PipelineSummariesDb =>
  db as unknown as PipelineSummariesDb;

const baseQuery: PipelineSummariesQuery = {
  page: 1,
  pageSize: 15,
  sortBy: "updated",
  sortDir: "desc",
};

const expectedSelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  updatedAt: true,
  createdById: true,
  createdBy: { select: { id: true, name: true, email: true } },
  domainIntegrationId: true,
  steps: {
    orderBy: { order: "asc" },
    select: {
      agentId: true,
      agentVersion: true,
      agentConfigId: true,
      input: true,
      config: true,
    },
  },
  _count: { select: { steps: true } },
};

const createPipelineRecord = (id: string) => ({
  id,
  name: `Pipeline ${id}`,
  description: "Runs every day",
  isActive: true,
  updatedAt: new Date("2026-09-20T08:00:00Z"),
  createdById: "u1",
  createdBy: { id: "u1", name: "Admin", email: "admin@example.com" },
  domainIntegrationId: "di-1",
  steps: [
    {
      agentId: "agent-a",
      agentVersion: "1.0.0",
      agentConfigId: null,
      input: { query: "news" },
      config: {},
    },
  ],
  _count: { steps: 1 },
});

describe("getPipelineSummariesPage", () => {
  afterEach(() => {
    getPipelinesValidationMapMock.mockReset();
  });

  it("loads one page ordered by last update and returns the total", async () => {
    const db = createDb();
    db.pipeline.findMany.mockResolvedValue([]);
    db.pipeline.count.mockResolvedValue(42);
    getPipelinesValidationMapMock.mockResolvedValue({});

    const result = await getPipelineSummariesPage(
      { ...baseQuery, page: 3, pageSize: 10 },
      asSummariesDb(db),
    );

    expect(db.pipeline.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: 20,
      take: 10,
      select: expectedSelect,
    });
    expect(db.pipeline.count).toHaveBeenCalledWith({ where: undefined });
    expect(result).toEqual({ pipelines: [], total: 42, page: 3, pageSize: 10 });
  });

  it("searches name and description without regard to case", async () => {
    const db = createDb();
    db.pipeline.findMany.mockResolvedValue([]);
    db.pipeline.count.mockResolvedValue(0);
    getPipelinesValidationMapMock.mockResolvedValue({});
    const expectedWhere = {
      OR: [
        { name: { contains: "digest", mode: "insensitive" } },
        { description: { contains: "digest", mode: "insensitive" } },
      ],
    };

    await getPipelineSummariesPage(
      { ...baseQuery, search: "  digest " },
      asSummariesDb(db),
    );

    expect(db.pipeline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(db.pipeline.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("ignores a blank search", async () => {
    const db = createDb();
    db.pipeline.findMany.mockResolvedValue([]);
    db.pipeline.count.mockResolvedValue(0);
    getPipelinesValidationMapMock.mockResolvedValue({});

    await getPipelineSummariesPage(
      { ...baseQuery, search: "   " },
      asSummariesDb(db),
    );

    expect(db.pipeline.count).toHaveBeenCalledWith({ where: undefined });
  });

  it("sorts by name with the id as a tiebreaker", async () => {
    const db = createDb();
    db.pipeline.findMany.mockResolvedValue([]);
    db.pipeline.count.mockResolvedValue(0);
    getPipelinesValidationMapMock.mockResolvedValue({});

    await getPipelineSummariesPage(
      { ...baseQuery, sortBy: "name", sortDir: "asc" },
      asSummariesDb(db),
    );

    expect(db.pipeline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("validates only the loaded page and attaches the result and step count to each row", async () => {
    const db = createDb();
    const pipelines = [createPipelineRecord("p1")];
    const validation = { valid: false, warnings: ["Step 1: missing input"] };
    db.pipeline.findMany.mockResolvedValue(pipelines);
    db.pipeline.count.mockResolvedValue(1);
    getPipelinesValidationMapMock.mockResolvedValue({ p1: validation });

    const result = await getPipelineSummariesPage(baseQuery, asSummariesDb(db));

    expect(getPipelinesValidationMapMock).toHaveBeenCalledWith(pipelines, db);
    expect(result.pipelines).toEqual([
      {
        id: "p1",
        name: "Pipeline p1",
        description: "Runs every day",
        isActive: true,
        updatedAt: new Date("2026-09-20T08:00:00Z"),
        createdById: "u1",
        createdBy: { id: "u1", name: "Admin", email: "admin@example.com" },
        stepCount: 1,
        validation,
      },
    ]);
  });

  it("treats a row without a validation result as invalid", async () => {
    const db = createDb();
    db.pipeline.findMany.mockResolvedValue([createPipelineRecord("p1")]);
    db.pipeline.count.mockResolvedValue(1);
    getPipelinesValidationMapMock.mockResolvedValue({});

    const result = await getPipelineSummariesPage(baseQuery, asSummariesDb(db));

    expect(result.pipelines[0]?.validation).toEqual({
      valid: false,
      warnings: [],
    });
  });
});

describe("getPipelineListItemsPage", () => {
  it("selects summary columns only and maps step counts", async () => {
    const db = createDb();
    const updatedAt = new Date("2026-09-20T08:00:00Z");
    db.pipeline.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Daily",
        description: null,
        isActive: true,
        updatedAt,
        _count: { steps: 3 },
      },
    ]);
    db.pipeline.count.mockResolvedValue(31);

    const result = await getPipelineListItemsPage(
      { page: 2, pageSize: 15, search: "dai", sortBy: "name", sortDir: "asc" },
      db as unknown as PipelineListItemsDb,
    );

    expect(db.pipeline.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: "dai", mode: "insensitive" } },
          { description: { contains: "dai", mode: "insensitive" } },
        ],
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: 15,
      take: 15,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        updatedAt: true,
        _count: { select: { steps: true } },
      },
    });
    expect(getPipelinesValidationMapMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      pipelines: [
        {
          id: "p1",
          name: "Daily",
          description: null,
          isActive: true,
          stepCount: 3,
          updatedAt,
        },
      ],
      total: 31,
      page: 2,
      pageSize: 15,
    });
  });
});
