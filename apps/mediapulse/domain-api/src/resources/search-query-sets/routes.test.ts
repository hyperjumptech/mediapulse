/**
 * Route wiring for search-query-sets: meta, list, and persist error handling.
 */

/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      searchQuerySet: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    },
  };
});

import { prisma } from "@mediapulse/database";
import { searchQuerySetsRoutes } from "./routes";

describe("searchQuerySetsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves GET /meta with table-v1 meta JSON", async () => {
    // Act
    const res = await searchQuerySetsRoutes.request("http://localhost/meta", {
      method: "GET",
    });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title?: string };
    expect(body.title).toBe("Search query sets");
  });

  it("returns paginated list items", async () => {
    // Setup
    vi.mocked(prisma.searchQuerySet.findMany).mockResolvedValue([
      {
        id: "set-1",
        tickerId: "ticker-1",
        generatedAt: new Date("2026-03-20T12:00:00.000Z"),
        isActive: true,
        strategySnapshot: {},
        generationSource: "manual",
        agentJobId: null,
        createdAt: new Date("2026-03-20T11:00:00.000Z"),
        updatedAt: new Date("2026-03-20T12:00:00.000Z"),
        ticker: { symbol: "AAPL", name: "Apple" },
        _count: { searchQueries: 2 },
      },
    ] as never);
    vi.mocked(prisma.searchQuerySet.count).mockResolvedValue(1);

    // Act
    const res = await searchQuerySetsRoutes.request("http://localhost/", {
      method: "GET",
    });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("set-1");
  });

  it("returns 400 when create body has duplicate query texts", async () => {
    // Act
    const res = await searchQuerySetsRoutes.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tickerId: "11111111-1111-4111-a111-111111111111",
        generationSource: "manual",
        isActive: false,
        strategySnapshot: "{}",
        queries: JSON.stringify([
          { text: "dup", source: "llm", intent: "breaking", rank: 1 },
          { text: "dup", source: "llm", intent: "breaking", rank: 2 },
        ]),
      }),
    });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toContain("Duplicate");
  });
});
