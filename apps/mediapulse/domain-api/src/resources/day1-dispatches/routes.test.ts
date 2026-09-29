/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      day1NewsletterDispatch: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
      },
      ticker: { findMany: vi.fn() },
    },
  };
});

import { prisma } from "@mediapulse/database";

import { buildDay1DispatchListWhere, day1DispatchesRoutes } from "./routes";

const row = {
  id: "dispatch-1",
  userTickerId: "ut-1",
  tickerId: "ticker-1",
  language: "en",
  kind: "bootstrap",
  status: "fired",
  reason: null,
  hermesExecutionId: "exec-1",
  error: null,
  createdAt: new Date("2026-09-29T08:00:00.000Z"),
  updatedAt: new Date("2026-09-29T08:00:01.000Z"),
  ticker: { symbol: "BBCA" },
  userTicker: { userId: "user-1", user: { email: "reader@example.com" } },
};

describe("day1DispatchesRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists dispatches newest first with readable labels", async () => {
    vi.mocked(prisma.day1NewsletterDispatch.findMany).mockResolvedValue([
      row,
    ] as never);
    vi.mocked(prisma.day1NewsletterDispatch.count).mockResolvedValue(1);

    const response = await day1DispatchesRoutes.request(
      "http://localhost/?status=fired&kind=bootstrap&tickerId=ticker-1",
    );
    const body = (await response.json()) as {
      items: Array<Record<string, unknown>>;
      total: number;
    };

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({
      tickerSymbol: "BBCA",
      subscriberEmail: "reader@example.com",
      kind: "Full chain",
      status: "Fired",
    });
    expect(prisma.day1NewsletterDispatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "fired", kind: "bootstrap", tickerId: "ticker-1" },
        orderBy: { createdAt: "desc" },
        skip: 0,
      }),
    );
  });

  it("ignores status and pipeline values it does not know", async () => {
    vi.mocked(prisma.day1NewsletterDispatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.day1NewsletterDispatch.count).mockResolvedValue(0);

    await day1DispatchesRoutes.request(
      "http://localhost/?status=bogus&kind=constructor",
    );

    expect(prisma.day1NewsletterDispatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("offers only tickers that have dispatches as filter options", async () => {
    vi.mocked(prisma.ticker.findMany).mockResolvedValue([
      { id: "ticker-1", symbol: "BBCA", name: "Bank Central Asia" },
    ] as never);

    const response = await day1DispatchesRoutes.request(
      "http://localhost/meta",
    );
    const body = (await response.json()) as {
      filterOptions: { tickerOptions: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(body.filterOptions.tickerOptions).toEqual([
      { value: "ticker-1", label: "BBCA — Bank Central Asia" },
    ]);
    expect(prisma.ticker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { day1NewsletterDispatches: { some: {} } },
      }),
    );
  });

  it("returns the detail payload for one dispatch", async () => {
    vi.mocked(prisma.day1NewsletterDispatch.findUnique).mockResolvedValue(
      row as never,
    );

    const response = await day1DispatchesRoutes.request(
      "http://localhost/dispatch-1",
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      title: "BBCA · reader@example.com",
      hermesExecutionId: "exec-1",
      userId: "user-1",
    });
  });

  it("returns 404 for an unknown dispatch", async () => {
    vi.mocked(prisma.day1NewsletterDispatch.findUnique).mockResolvedValue(null);

    const response = await day1DispatchesRoutes.request(
      "http://localhost/missing",
    );

    expect(response.status).toBe(404);
  });
});

describe("buildDay1DispatchListWhere", () => {
  it("searches the ticker symbol and subscriber email and applies the date range", () => {
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-09-30T23:59:59.999Z");

    const where = buildDay1DispatchListWhere({
      q: "bbca",
      status: undefined,
      kind: undefined,
      tickerId: undefined,
      from,
      to,
    });

    expect(where).toEqual({
      OR: [
        { ticker: { symbol: { contains: "bbca", mode: "insensitive" } } },
        {
          userTicker: {
            user: { email: { contains: "bbca", mode: "insensitive" } },
          },
        },
      ],
      createdAt: { gte: from, lte: to },
    });
  });
});
