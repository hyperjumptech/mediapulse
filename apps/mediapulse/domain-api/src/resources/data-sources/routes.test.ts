/**
 * Route wiring for data-sources: `GET /meta` must not be captured by `GET /:id`.
 */

/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      dataSource: {
        ...actual.prisma.dataSource,
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

import { dataSourcesResetAllConfirmToken } from "./custom-actions";
import { dataSourcesRoutes } from "./routes";

describe("dataSourcesRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves GET /meta with table-v1 meta JSON and filter options", async () => {
    vi.mocked(prisma.ticker.findMany).mockResolvedValue([
      {
        id: "11111111-1111-4111-a111-111111111111",
        symbol: "AAPL",
        name: "Apple",
      },
    ] as never);

    const res = await dataSourcesRoutes.request("http://localhost/meta", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      title?: string;
      listFilters?: string[];
      tickerOptions?: Array<{ value: string; label: string }>;
    };
    expect(body.title).toBe("Data Sources");
    expect(body.listFilters).toEqual(["tickerId", "createdAt"]);
    expect(body.tickerOptions).toEqual([
      {
        value: "11111111-1111-4111-a111-111111111111",
        label: "AAPL — Apple",
      },
    ]);
  });

  it("passes list filter query params to Prisma findMany", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.dataSource.count).mockResolvedValue(0);

    const res = await dataSourcesRoutes.request(
      "http://localhost/?tickerId=11111111-1111-4111-a111-111111111111&from=2026-05-01&to=2026-05-31",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    expect(prisma.dataSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tickerId: "11111111-1111-4111-a111-111111111111" },
            {
              createdAt: {
                gte: new Date("2026-05-01T00:00:00.000Z"),
                lte: new Date("2026-05-31T23:59:59.999Z"),
              },
            },
          ],
        },
      }),
    );
  });

  it("reset-all deletes every data source when confirm token matches", async () => {
    vi.mocked(prisma.dataSource.deleteMany).mockResolvedValue({ count: 2 });

    const res = await dataSourcesRoutes.request("http://localhost/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: dataSourcesResetAllConfirmToken }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 2 });
    expect(prisma.dataSource.deleteMany).toHaveBeenCalledWith({});
  });
});
