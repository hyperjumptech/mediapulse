/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    queryAnalysisRun: {
      create: vi.fn(),
    },
  },
}));

import { createQueryAnalysisRun } from "./query-analysis-run.js";

type FakeDb = {
  queryAnalysisRun: { create: ReturnType<typeof vi.fn> };
};

const makeDb = (): FakeDb => ({
  queryAnalysisRun: {
    create: vi.fn().mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      tickerId: "11111111-1111-4111-a111-111111111111",
      executionId: "exec-1",
      queries: [],
      createdAt: new Date("2026-07-08T10:00:00.000Z"),
    }),
  },
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createQueryAnalysisRun", () => {
  it("persists tickerId, executionId, and the decision array", async () => {
    // Setup
    const db = makeDb();
    const queries = [
      { text: "q1", included: true, reason: "included — 5 search hits" },
      {
        text: "q2",
        included: false,
        reason: "rejected — 0 search hits (below minimum)",
      },
    ];

    // Act
    await createQueryAnalysisRun(
      {
        tickerId: "11111111-1111-4111-a111-111111111111",
        executionId: "exec-1",
        queries,
      },
      {
        db: db as unknown as NonNullable<
          Parameters<typeof createQueryAnalysisRun>[1]
        >["db"],
      },
    );

    // Assert
    expect(db.queryAnalysisRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tickerId: "11111111-1111-4111-a111-111111111111",
          executionId: "exec-1",
          queries,
        }),
      }),
    );
  });

  it("defaults executionId to null when omitted", async () => {
    // Setup
    const db = makeDb();

    // Act
    await createQueryAnalysisRun(
      { tickerId: "11111111-1111-4111-a111-111111111111", queries: [] },
      {
        db: db as unknown as NonNullable<
          Parameters<typeof createQueryAnalysisRun>[1]
        >["db"],
      },
    );

    // Assert
    const createArgs = db.queryAnalysisRun.create.mock.calls[0]?.[0] as {
      data: { executionId: string | null };
    };

    expect(createArgs.data.executionId).toBeNull();
  });
});
