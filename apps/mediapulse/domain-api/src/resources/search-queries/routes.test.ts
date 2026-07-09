/**
 * Route wiring for search-queries: meta, list filters, and delete.
 */

/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      searchQuery: {
        findMany: vi.fn(),
        count: vi.fn(),
        deleteMany: vi.fn(),
      },
      ticker: {
        findMany: vi.fn(),
      },
    },
  };
});

import { prisma } from "@mediapulse/database";
import { searchQueriesRoutes } from "./routes";

describe("searchQueriesRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves GET /meta with filter options", async () => {
    vi.mocked(prisma.ticker.findMany).mockResolvedValue([
      {
        id: "11111111-1111-4111-a111-111111111111",
        symbol: "AAPL",
        name: "Apple",
      },
    ] as never);
    vi.mocked(prisma.searchQuery.findMany).mockResolvedValue([
      { intent: "breaking" },
      { intent: "competitor" },
    ] as never);

    const res = await searchQueriesRoutes.request("http://localhost/meta", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      title?: string;
      listFilters?: Array<{ key: string }>;
      filterOptions?: Record<string, Array<{ value: string; label: string }>>;
    };
    expect(body.title).toBe("Search Queries");
    expect(body.listFilters?.map((filter) => filter.key)).toEqual([
      "tickerId",
      "isActive",
      "intent",
      "createdAt",
    ]);
    expect(body.filterOptions?.tickerOptions).toEqual([
      {
        value: "11111111-1111-4111-a111-111111111111",
        label: "AAPL — Apple",
      },
    ]);
    expect(
      body.filterOptions?.intentOptions?.some(
        (option) => option.value === "breaking",
      ),
    ).toBe(true);
    expect(body.filterOptions?.sourceOptions).toBeUndefined();
  });

  it("passes list filter query params to Prisma findMany", async () => {
    vi.mocked(prisma.searchQuery.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.searchQuery.count).mockResolvedValue(0);

    const res = await searchQueriesRoutes.request(
      "http://localhost/?tickerId=11111111-1111-4111-a111-111111111111&intent=breaking&isActive=true&from=2026-05-01",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    expect(prisma.searchQuery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tickerId: "11111111-1111-4111-a111-111111111111" },
            { intent: "breaking" },
            { set: { isActive: true } },
            {
              createdAt: {
                gte: new Date("2026-05-01T00:00:00.000Z"),
              },
            },
          ],
        },
      }),
    );
  });
});
