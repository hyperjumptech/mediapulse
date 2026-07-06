/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import {
  lookupTickerDiscovery,
  recordTickerDiscovery,
} from "./ticker-discovery";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const COMPETITORS = [
  { name: "Rival Co", aliases: ["Rival"], searchKeywords: ["rival co"] },
];
const REGULATORS = [
  { name: "OJK", aliases: [], searchKeywords: ["otoritas jasa keuangan"] },
];

describe("lookupTickerDiscovery", () => {
  it("returns the cached entry when it is not expired", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-02T00:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue({
      tickerId: TICKER_ID,
      competitors: COMPETITORS,
      regulators: REGULATORS,
      model: "gpt-test",
      expiresAt,
    });

    const result = await lookupTickerDiscovery(
      { tickerId: TICKER_ID },
      { tickerDiscovery: { findFirst, upsert: vi.fn() }, now },
    );

    expect(result).toEqual({
      tickerId: TICKER_ID,
      competitors: COMPETITORS,
      regulators: REGULATORS,
      model: "gpt-test",
      expiresAt: expiresAt.toISOString(),
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { tickerId: TICKER_ID, expiresAt: { gt: now } },
      select: {
        tickerId: true,
        competitors: true,
        regulators: true,
        model: true,
        expiresAt: true,
      },
    });
  });

  it("returns null on a miss (stale rows are filtered by the expiresAt guard)", async () => {
    const now = new Date("2026-06-08T00:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue(null);

    const result = await lookupTickerDiscovery(
      { tickerId: TICKER_ID },
      { tickerDiscovery: { findFirst, upsert: vi.fn() }, now },
    );

    expect(result).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ expiresAt: { gt: now } }),
      }),
    );
  });
});

describe("recordTickerDiscovery", () => {
  it("upserts and renews expiresAt from ttlSeconds", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date(now.getTime() + 3600 * 1000);
    const upsert = vi
      .fn()
      .mockResolvedValue({ tickerId: TICKER_ID, expiresAt });

    const result = await recordTickerDiscovery(
      {
        tickerId: TICKER_ID,
        competitors: COMPETITORS,
        regulators: REGULATORS,
        model: "gpt-test",
        ttlSeconds: 3600,
      },
      { tickerDiscovery: { findFirst: vi.fn(), upsert }, now },
    );

    expect(result).toEqual({
      tickerId: TICKER_ID,
      expiresAt: expiresAt.toISOString(),
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { tickerId: TICKER_ID },
      create: {
        tickerId: TICKER_ID,
        competitors: COMPETITORS,
        regulators: REGULATORS,
        model: "gpt-test",
        expiresAt,
      },
      update: {
        competitors: COMPETITORS,
        regulators: REGULATORS,
        model: "gpt-test",
        expiresAt,
      },
      select: { tickerId: true, expiresAt: true },
    });
  });

  it("stores a null model when none is provided", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date(now.getTime() + 1800 * 1000);
    const upsert = vi
      .fn()
      .mockResolvedValue({ tickerId: TICKER_ID, expiresAt });

    await recordTickerDiscovery(
      {
        tickerId: TICKER_ID,
        competitors: [],
        regulators: [],
        ttlSeconds: 1800,
      },
      { tickerDiscovery: { findFirst: vi.fn(), upsert }, now },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ model: null }),
        update: expect.objectContaining({ model: null }),
      }),
    );
  });
});
