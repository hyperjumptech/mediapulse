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
const MAIN_INPUTS = ["arabica beans", "dairy"];
const CUSTOMER_SEGMENTS = ["urban middle class"];

describe("lookupTickerDiscovery", () => {
  it("returns the cached entry when it is not expired", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-02T00:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue({
      tickerId: TICKER_ID,
      competitors: COMPETITORS,
      regulators: REGULATORS,
      mainInputs: MAIN_INPUTS,
      customerSegments: CUSTOMER_SEGMENTS,
      model: "gpt-test",
      contractVersion: "1.0",
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
      mainInputs: MAIN_INPUTS,
      customerSegments: CUSTOMER_SEGMENTS,
      model: "gpt-test",
      contractVersion: "1.0",
      expiresAt: expiresAt.toISOString(),
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { tickerId: TICKER_ID, expiresAt: { gt: now } },
      select: {
        tickerId: true,
        competitors: true,
        regulators: true,
        mainInputs: true,
        customerSegments: true,
        model: true,
        contractVersion: true,
        expiresAt: true,
      },
    });
  });

  it("returns a null contractVersion for legacy entries written before the column existed", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-02T00:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue({
      tickerId: TICKER_ID,
      competitors: COMPETITORS,
      regulators: REGULATORS,
      model: "gpt-test",
      contractVersion: null,
      expiresAt,
    });

    const result = await lookupTickerDiscovery(
      { tickerId: TICKER_ID },
      { tickerDiscovery: { findFirst, upsert: vi.fn() }, now },
    );

    expect(result?.contractVersion).toBeNull();
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
        mainInputs: MAIN_INPUTS,
        customerSegments: CUSTOMER_SEGMENTS,
        model: "gpt-test",
        contractVersion: "2.1",
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
        mainInputs: MAIN_INPUTS,
        customerSegments: CUSTOMER_SEGMENTS,
        model: "gpt-test",
        contractVersion: "2.1",
        expiresAt,
      },
      update: {
        competitors: COMPETITORS,
        regulators: REGULATORS,
        mainInputs: MAIN_INPUTS,
        customerSegments: CUSTOMER_SEGMENTS,
        model: "gpt-test",
        contractVersion: "2.1",
        expiresAt,
      },
      select: { tickerId: true, expiresAt: true },
    });
  });

  it("stores a null model and contractVersion when neither is provided", async () => {
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
        mainInputs: [],
        customerSegments: [],
        ttlSeconds: 1800,
      },
      { tickerDiscovery: { findFirst: vi.fn(), upsert }, now },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ model: null, contractVersion: null }),
        update: expect.objectContaining({ model: null, contractVersion: null }),
      }),
    );
  });
});
