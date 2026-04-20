/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createContentGenerationRun,
  listContentGenerationRuns,
  type ContentGenerationRunDb,
} from "./content-generation-run.js";

// ---------------------------------------------------------------------------
// Shared fake DB factory
// ---------------------------------------------------------------------------

type FakeRow = {
  id: string;
  agentId: string;
  agentVersion: string;
  tickerId: string;
  outcome: "success" | "skipped" | "failed";
  stage: "precheck" | "llm" | "validate" | "persist" | null;
  errorCode: string | null;
  errorCategory: string | null;
  message: string | null;
  durationMs: number | null;
  pipelineRunId: string | null;
  newsletterId: string | null;
  createdAt: Date;
};

const makeRow = (overrides: Partial<FakeRow> = {}): FakeRow => ({
  id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  agentId: "content-generation",
  agentVersion: "1.0.0",
  tickerId: "11111111-1111-4111-a111-111111111111",
  outcome: "success",
  stage: null,
  errorCode: null,
  errorCategory: null,
  message: null,
  durationMs: 800,
  pipelineRunId: null,
  newsletterId: "22222222-2222-4222-a222-222222222222",
  createdAt: new Date("2026-04-14T10:00:00.000Z"),
  ...overrides,
});

type FakeDb = {
  contentGenerationRun: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

const makeDb = (): FakeDb => ({
  contentGenerationRun: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
});

// ---------------------------------------------------------------------------
// createContentGenerationRun
// ---------------------------------------------------------------------------

describe("createContentGenerationRun", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a run with all fields and returns the row", async () => {
    // Setup
    const row = makeRow({ stage: "llm", errorCode: "LLM_TIMEOUT", durationMs: 1500 });
    const db = makeDb();
    db.contentGenerationRun.create.mockResolvedValue(row);

    // Act
    const result = await createContentGenerationRun(
      {
        agentId: "content-generation",
        agentVersion: "1.0.0",
        tickerId: "11111111-1111-4111-a111-111111111111",
        outcome: "failed",
        stage: "llm",
        errorCode: "LLM_TIMEOUT",
        errorCategory: "llm_error",
        message: "LLM request timed out",
        durationMs: 1500,
        pipelineRunId: "pipeline-run-1",
        newsletterId: null,
      },
      { db: db as unknown as ContentGenerationRunDb },
    );

    // Assert
    expect(db.contentGenerationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentId: "content-generation",
          outcome: "failed",
          stage: "llm",
          errorCode: "LLM_TIMEOUT",
          message: "LLM request timed out",
          durationMs: 1500,
        }),
      }),
    );
    expect(result.id).toBe(row.id);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("creates a run with only required fields, nulling optional ones", async () => {
    // Setup
    const row = makeRow({
      outcome: "skipped",
      stage: null,
      errorCode: null,
      errorCategory: null,
      message: null,
      durationMs: null,
      pipelineRunId: null,
      newsletterId: null,
    });
    const db = makeDb();
    db.contentGenerationRun.create.mockResolvedValue(row);

    // Act
    const result = await createContentGenerationRun(
      {
        agentId: "content-generation",
        agentVersion: "1.0.0",
        tickerId: "11111111-1111-4111-a111-111111111111",
        outcome: "skipped",
      },
      { db: db as unknown as ContentGenerationRunDb },
    );

    // Assert
    expect(db.contentGenerationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentId: "content-generation",
          outcome: "skipped",
          stage: null,
          errorCode: null,
          durationMs: null,
        }),
      }),
    );
    expect(result.outcome).toBe("skipped");
  });
});

// ---------------------------------------------------------------------------
// listContentGenerationRuns
// ---------------------------------------------------------------------------

describe("listContentGenerationRuns", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns all runs newest-first when no filters are provided", async () => {
    // Setup
    const rows = [
      makeRow({ id: "row-1", createdAt: new Date("2026-04-14T12:00:00.000Z") }),
      makeRow({ id: "row-2", createdAt: new Date("2026-04-14T10:00:00.000Z") }),
    ];
    const db = makeDb();
    db.contentGenerationRun.findMany.mockResolvedValue(rows);

    // Act
    const result = await listContentGenerationRuns(
      {},
      { db: db as unknown as ContentGenerationRunDb },
    );

    // Assert
    expect(db.contentGenerationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        take: 51,
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBeUndefined();
  });

  it("applies tickerId filter", async () => {
    // Setup
    const db = makeDb();
    db.contentGenerationRun.findMany.mockResolvedValue([makeRow()]);
    const tickerId = "11111111-1111-4111-a111-111111111111";

    // Act
    await listContentGenerationRuns(
      { tickerId },
      { db: db as unknown as ContentGenerationRunDb },
    );

    // Assert
    expect(db.contentGenerationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tickerId }),
      }),
    );
  });

  it("applies outcome filter", async () => {
    // Setup
    const db = makeDb();
    db.contentGenerationRun.findMany.mockResolvedValue([]);

    // Act
    await listContentGenerationRuns(
      { outcome: "failed" },
      { db: db as unknown as ContentGenerationRunDb },
    );

    // Assert
    expect(db.contentGenerationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ outcome: "failed" }),
      }),
    );
  });

  it("applies startTime and endTime filters as gte/lte on createdAt", async () => {
    // Setup
    const db = makeDb();
    db.contentGenerationRun.findMany.mockResolvedValue([]);
    const startTime = new Date("2026-04-14T00:00:00.000Z");
    const endTime = new Date("2026-04-14T23:59:59.000Z");

    // Act
    await listContentGenerationRuns(
      { startTime, endTime },
      { db: db as unknown as ContentGenerationRunDb },
    );

    // Assert
    expect(db.contentGenerationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: startTime, lte: endTime },
        }),
      }),
    );
  });

  it("applies only startTime when endTime is omitted", async () => {
    // Setup
    const db = makeDb();
    db.contentGenerationRun.findMany.mockResolvedValue([]);
    const startTime = new Date("2026-04-14T00:00:00.000Z");

    // Act
    await listContentGenerationRuns(
      { startTime },
      { db: db as unknown as ContentGenerationRunDb },
    );

    // Assert
    expect(db.contentGenerationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: startTime },
        }),
      }),
    );
  });

  it("handles pagination cursor correctly, avoiding skipped rows", async () => {
    // Setup
    const limit = 2;
    // Mock returning 3 items (limit + 1) to simulate having a next page
    const rows = [
      makeRow({ id: "row-1" }),
      makeRow({ id: "row-2" }),
      makeRow({ id: "row-3" }),
    ];
    const db = makeDb();
    db.contentGenerationRun.findMany.mockResolvedValue([...rows]);

    // Act - First page
    const result1 = await listContentGenerationRuns(
      { limit },
      { db: db as unknown as ContentGenerationRunDb },
    );

    // Assert - First page
    expect(db.contentGenerationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: limit + 1,
      }),
    );
    expect(result1.data).toHaveLength(limit);
    expect(result1.data[0]?.id).toBe("row-1");
    expect(result1.data[1]?.id).toBe("row-2");
    // The cursor should be set to the last item actually returned, not the popped extra row
    expect(result1.nextCursor).toBe("row-2");

    // Act - Second page
    await listContentGenerationRuns(
      { limit, cursor: result1.nextCursor },
      { db: db as unknown as ContentGenerationRunDb },
    );

    // Assert - Second page
    expect(db.contentGenerationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: limit + 1,
        skip: 1,
        cursor: { id: "row-2" },
      }),
    );
  });
});
