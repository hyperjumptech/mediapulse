/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    contentGenerationRun: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import {
  createContentGenerationRun,
  listContentGenerationRuns,
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
    const row = makeRow({
      stage: "llm",
      errorCode: "LLM_TIMEOUT",
      durationMs: 1500,
    });
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
      {
        db: db as unknown as Parameters<
          typeof createContentGenerationRun
        >[1] extends { db?: infer D }
          ? NonNullable<D>
          : never,
      },
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
      {
        db: db as unknown as Parameters<
          typeof createContentGenerationRun
        >[1] extends { db?: infer D }
          ? NonNullable<D>
          : never,
      },
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
    expect(result.outcome).toBe("success"); // fixture value
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
      {
        db: db as unknown as Parameters<
          typeof listContentGenerationRuns
        >[1] extends { db?: infer D }
          ? NonNullable<D>
          : never,
      },
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
      {
        db: db as unknown as Parameters<
          typeof listContentGenerationRuns
        >[1] extends { db?: infer D }
          ? NonNullable<D>
          : never,
      },
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
      {
        db: db as unknown as Parameters<
          typeof listContentGenerationRuns
        >[1] extends { db?: infer D }
          ? NonNullable<D>
          : never,
      },
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
      {
        db: db as unknown as Parameters<
          typeof listContentGenerationRuns
        >[1] extends { db?: infer D }
          ? NonNullable<D>
          : never,
      },
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
      {
        db: db as unknown as Parameters<
          typeof listContentGenerationRuns
        >[1] extends { db?: infer D }
          ? NonNullable<D>
          : never,
      },
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
});
