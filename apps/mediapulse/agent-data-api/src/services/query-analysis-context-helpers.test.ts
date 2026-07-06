/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildPeerColumnFilters,
  extractMarketCap,
  extractTickerSectorIndustry,
  sortAndLimitPeers,
} from "./query-analysis-context-helpers";

describe("extractTickerSectorIndustry", () => {
  it("reads and trims the structured columns", () => {
    expect(
      extractTickerSectorIndustry({ sector: " Energy ", industry: "Oil" }),
    ).toEqual({ sector: "Energy", industry: "Oil" });
  });

  it("normalizes empty and null columns to undefined", () => {
    expect(
      extractTickerSectorIndustry({ sector: "  ", industry: null }),
    ).toEqual({ sector: undefined, industry: undefined });
  });
});

describe("extractMarketCap", () => {
  it("parses numeric and string market cap values", () => {
    expect(extractMarketCap({ marketCap: 1_000_000 })).toBe(1_000_000);
    expect(extractMarketCap({ MarketCap: "2,500,000" })).toBe(2_500_000);
  });

  it("returns null when the blob has no market cap", () => {
    expect(extractMarketCap({ Sektor: "Energy" })).toBeNull();
    expect(extractMarketCap(null)).toBeNull();
  });
});

describe("buildPeerColumnFilters", () => {
  it("returns undefined when sector and industry are absent", () => {
    expect(buildPeerColumnFilters(undefined, undefined)).toBeUndefined();
  });

  it("builds column equality OR clauses when present", () => {
    expect(buildPeerColumnFilters("Energy", "Oil")).toEqual([
      { sector: { equals: "Energy" } },
      { industry: { equals: "Oil" } },
    ]);
  });
});

describe("sortAndLimitPeers", () => {
  it("orders by market cap descending then id", () => {
    const sorted = sortAndLimitPeers([
      {
        id: "b",
        symbol: "B",
        name: "B Co",
        metadataRaw: { marketCap: 100 },
      },
      {
        id: "a",
        symbol: "A",
        name: "A Co",
        metadataRaw: { marketCap: 200 },
      },
    ]);

    expect(sorted.map((peer) => peer.symbol)).toEqual(["A", "B"]);
  });
});
