/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import {
  getDiscoverySourceHealth,
  recordDiscoverySourceHealth,
} from "./discovery-source-health";

const makeRow = (
  overrides: Partial<{
    listingUrl: string;
    runDate: Date;
    discovered: boolean;
    itemCount: number;
    winningStrategy: string | null;
    failureCount: number;
    lastError: string | null;
    computedAt: Date;
  }> = {},
) => ({
  id: "row-id",
  listingUrl: "https://example.com/feed",
  runDate: new Date("2026-06-08T00:00:00.000Z"),
  discovered: true,
  itemCount: 3,
  winningStrategy: "rss" as string | null,
  failureCount: 0,
  lastError: null as string | null,
  computedAt: new Date("2026-06-08T10:00:00.000Z"),
  ...overrides,
});

describe("recordDiscoverySourceHealth", () => {
  it("upserts each record with normalized runDate", async () => {
    const now = new Date("2026-06-08T12:00:00.000Z");
    const upsert = vi.fn().mockResolvedValue({});

    const recorded = await recordDiscoverySourceHealth(
      [
        {
          listingUrl: "https://example.com/feed",
          runDate: "2026-06-08T09:45:00.000Z",
          discovered: true,
          itemCount: 5,
          winningStrategy: "rss",
          failureCount: 0,
          lastError: null,
        },
      ],
      {
        discoverySourceHealth: { upsert, findMany: vi.fn() },
        now,
      },
    );

    expect(recorded).toBe(1);
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          listingUrl_runDate: {
            listingUrl: "https://example.com/feed",
            runDate: new Date("2026-06-08T00:00:00.000Z"),
          },
        },
        create: expect.objectContaining({
          listingUrl: "https://example.com/feed",
          runDate: new Date("2026-06-08T00:00:00.000Z"),
          discovered: true,
          itemCount: 5,
          winningStrategy: "rss",
          failureCount: 0,
          lastError: null,
        }),
        update: expect.objectContaining({
          discovered: true,
          itemCount: 5,
          winningStrategy: "rss",
          failureCount: 0,
          lastError: null,
          computedAt: now,
        }),
      }),
    );
  });

  it("upserts multiple records and returns the count", async () => {
    const upsert = vi.fn().mockResolvedValue({});

    const recorded = await recordDiscoverySourceHealth(
      [
        {
          listingUrl: "https://a.com/feed",
          runDate: "2026-06-08T00:00:00.000Z",
          discovered: true,
          itemCount: 2,
          failureCount: 0,
        },
        {
          listingUrl: "https://b.com/feed",
          runDate: "2026-06-08T00:00:00.000Z",
          discovered: false,
          itemCount: 0,
          failureCount: 3,
          lastError: "Connection refused",
        },
      ],
      {
        discoverySourceHealth: { upsert, findMany: vi.fn() },
      },
    );

    expect(recorded).toBe(2);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("returns 0 and does not call upsert when records array is empty", async () => {
    const upsert = vi.fn();

    const recorded = await recordDiscoverySourceHealth([], {
      discoverySourceHealth: { upsert, findMany: vi.fn() },
    });

    expect(recorded).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("getDiscoverySourceHealth", () => {
  it("returns empty array when listingUrls is empty", async () => {
    const findMany = vi.fn();

    const result = await getDiscoverySourceHealth(
      { listingUrls: [], windowDays: 30 },
      { discoverySourceHealth: { upsert: vi.fn(), findMany } },
    );

    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns entry with empty rows and zero signals when no data exists", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const result = await getDiscoverySourceHealth(
      { listingUrls: ["https://example.com/feed"], windowDays: 30 },
      { discoverySourceHealth: { upsert: vi.fn(), findMany } },
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      listingUrl: "https://example.com/feed",
      rows: [],
      consecutiveFailedRuns: 0,
      lastSuccessfulAt: null,
      failureRate: 0,
    });
  });

  it("computes consecutiveFailedRuns from trailing failed rows (newest first)", async () => {
    const findMany = vi.fn().mockResolvedValue([
      makeRow({
        runDate: new Date("2026-06-08T00:00:00.000Z"),
        discovered: false,
        computedAt: new Date("2026-06-08T10:00:00.000Z"),
      }),
      makeRow({
        runDate: new Date("2026-06-07T00:00:00.000Z"),
        discovered: false,
        computedAt: new Date("2026-06-07T10:00:00.000Z"),
      }),
      makeRow({
        runDate: new Date("2026-06-06T00:00:00.000Z"),
        discovered: true,
        computedAt: new Date("2026-06-06T10:00:00.000Z"),
      }),
    ]);

    const result = await getDiscoverySourceHealth(
      { listingUrls: ["https://example.com/feed"], windowDays: 30 },
      { discoverySourceHealth: { upsert: vi.fn(), findMany } },
    );

    expect(result[0]!.consecutiveFailedRuns).toBe(2);
  });

  it("returns consecutiveFailedRuns of 0 when the latest row is discovered", async () => {
    const findMany = vi.fn().mockResolvedValue([
      makeRow({
        runDate: new Date("2026-06-08T00:00:00.000Z"),
        discovered: true,
      }),
      makeRow({
        runDate: new Date("2026-06-07T00:00:00.000Z"),
        discovered: false,
      }),
    ]);

    const result = await getDiscoverySourceHealth(
      { listingUrls: ["https://example.com/feed"], windowDays: 30 },
      { discoverySourceHealth: { upsert: vi.fn(), findMany } },
    );

    expect(result[0]!.consecutiveFailedRuns).toBe(0);
  });

  it("computes lastSuccessfulAt from the most recent discovered row", async () => {
    const successComputedAt = new Date("2026-06-07T10:00:00.000Z");
    const findMany = vi.fn().mockResolvedValue([
      makeRow({
        runDate: new Date("2026-06-08T00:00:00.000Z"),
        discovered: false,
        computedAt: new Date("2026-06-08T10:00:00.000Z"),
      }),
      makeRow({
        runDate: new Date("2026-06-07T00:00:00.000Z"),
        discovered: true,
        computedAt: successComputedAt,
      }),
    ]);

    const result = await getDiscoverySourceHealth(
      { listingUrls: ["https://example.com/feed"], windowDays: 30 },
      { discoverySourceHealth: { upsert: vi.fn(), findMany } },
    );

    expect(result[0]!.lastSuccessfulAt).toBe(successComputedAt.toISOString());
  });

  it("computes failureRate as the ratio of not-discovered rows to total", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        makeRow({ discovered: true }),
        makeRow({ discovered: false }),
        makeRow({ discovered: false }),
        makeRow({ discovered: true }),
      ]);

    const result = await getDiscoverySourceHealth(
      { listingUrls: ["https://example.com/feed"], windowDays: 30 },
      { discoverySourceHealth: { upsert: vi.fn(), findMany } },
    );

    expect(result[0]!.failureRate).toBe(0.5);
  });

  it("passes the correct window start date to the query", async () => {
    const now = new Date("2026-06-08T12:00:00.000Z");
    const findMany = vi.fn().mockResolvedValue([]);

    await getDiscoverySourceHealth(
      { listingUrls: ["https://example.com/feed"], windowDays: 7 },
      {
        discoverySourceHealth: { upsert: vi.fn(), findMany },
        now,
      },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          runDate: {
            gte: new Date("2026-06-01T00:00:00.000Z"),
          },
        }),
      }),
    );
  });
});
