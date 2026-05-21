/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildKgNeighborhood,
  buildPeerMetadataOrFilters,
  collectRecentEventTypes,
  extractMarketCap,
  extractTickerSectorIndustry,
  mapPeersWithRelevance,
  pickMetadataString,
  resolveHeadlinePublishedAt,
  sortAndLimitPeers,
  sourceNameFromUrl,
} from "./query-analysis-context-helpers";

describe("pickMetadataString", () => {
  it("returns the first matching non-empty string key", () => {
    expect(
      pickMetadataString({ Sektor: "Finance", sector: "Ignored" }, [
        "Sektor",
        "sector",
      ]),
    ).toBe("Finance");
  });
});

describe("extractTickerSectorIndustry", () => {
  it("reads IDX and admin metadata keys", () => {
    expect(
      extractTickerSectorIndustry({ Sektor: "Energy", Industri: "Oil" }),
    ).toEqual({ sector: "Energy", industry: "Oil" });
  });
});

describe("extractMarketCap", () => {
  it("parses numeric and string market cap values", () => {
    expect(extractMarketCap({ marketCap: 1_000_000 })).toBe(1_000_000);
    expect(extractMarketCap({ MarketCap: "2,500,000" })).toBe(2_500_000);
  });
});

describe("buildPeerMetadataOrFilters", () => {
  it("returns undefined when sector and industry are absent", () => {
    expect(buildPeerMetadataOrFilters(undefined, undefined)).toBeUndefined();
  });
});

describe("sortAndLimitPeers", () => {
  it("orders by market cap descending then id", () => {
    const sorted = sortAndLimitPeers([
      {
        id: "b",
        symbol: "B",
        name: "B Co",
        metadata: { marketCap: 100 },
      },
      {
        id: "a",
        symbol: "A",
        name: "A Co",
        metadata: { marketCap: 200 },
      },
    ]);

    expect(sorted.map((peer) => peer.symbol)).toEqual(["A", "B"]);
  });
});

describe("mapPeersWithRelevance", () => {
  it("assigns descending relevance scores", () => {
    expect(
      mapPeersWithRelevance([
        { symbol: "AAA", name: "Alpha" },
        { symbol: "BBB", name: "Beta" },
      ]),
    ).toEqual([
      { symbol: "AAA", name: "Alpha", relevance: 1 },
      { symbol: "BBB", name: "Beta", relevance: 0.9 },
    ]);
  });
});

describe("sourceNameFromUrl", () => {
  it("returns hostname without www prefix", () => {
    expect(sourceNameFromUrl("https://www.reuters.com/article/1")).toBe(
      "reuters.com",
    );
  });
});

describe("resolveHeadlinePublishedAt", () => {
  it("prefers metadata publishedAt over createdAt", () => {
    expect(
      resolveHeadlinePublishedAt(
        { publishedAt: "2026-05-18T08:00:00.000Z" },
        new Date("2026-05-19T00:00:00.000Z"),
      ),
    ).toBe("2026-05-18T08:00:00.000Z");
  });
});

describe("collectRecentEventTypes", () => {
  it("deduplicates event types in first-seen order", () => {
    expect(
      collectRecentEventTypes([
        { metadata: { eventType: "ratings_change" } },
        { metadata: { eventType: "executive_departure" } },
        { metadata: { eventType: "ratings_change" } },
      ]),
    ).toEqual(["ratings_change", "executive_departure"]);
  });
});

describe("buildKgNeighborhood", () => {
  it("caps per-entity and global relation counts with dedupe", () => {
    const neighborhood = buildKgNeighborhood(
      ["entity-a"],
      [
        {
          fromEntityId: "entity-a",
          toEntityId: "entity-b",
          fromEntity: { canonicalName: "A" },
          toEntity: { canonicalName: "B" },
          relationType: { name: "owns" },
        },
        {
          fromEntityId: "entity-a",
          toEntityId: "entity-c",
          fromEntity: { canonicalName: "A" },
          toEntity: { canonicalName: "C" },
          relationType: { name: "owns" },
        },
        {
          fromEntityId: "entity-a",
          toEntityId: "entity-b",
          fromEntity: { canonicalName: "A" },
          toEntity: { canonicalName: "B" },
          relationType: { name: "owns" },
        },
      ],
    );

    expect(neighborhood).toEqual([
      { fromEntity: "A", relationType: "owns", toEntity: "B" },
      { fromEntity: "A", relationType: "owns", toEntity: "C" },
    ]);
  });
});
