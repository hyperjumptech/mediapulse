import { afterEach, describe, expect, it, vi } from "vitest";

import type { SourceForGeneration } from "../types.js";
import {
  buildSourceMixObservability,
  classifyHostTier,
  diversifyByHost,
  extractPublishedAtMs,
  extractSourceHost,
  rankSourcesForNewsletter,
} from "./source-ranking.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const makeSource = (
  patch: Partial<SourceForGeneration> &
    Pick<SourceForGeneration, "url" | "title">,
): SourceForGeneration => ({
  content: "x".repeat(1500),
  ...patch,
});

const FIXED_NOW = new Date("2026-05-22T12:00:00.000Z");

const defaultRankOpts = {
  recencyHalfLifeHours: 36,
  weights: { relevance: 0.45, recency: 0.25, tier: 0.2, length: 0.1 },
  now: FIXED_NOW,
};

describe("extractPublishedAtMs", () => {
  it("returns epoch ms for a valid ISO publishedAt", () => {
    // Act
    const ms = extractPublishedAtMs({
      url: "https://example.com/a",
      title: "A",
      content: "body",
      publishedAt: "2026-05-20T00:00:00.000Z",
    });

    // Assert
    expect(ms).toBe(Date.parse("2026-05-20T00:00:00.000Z"));
  });

  it("returns null when publishedAt is absent", () => {
    // Act
    const ms = extractPublishedAtMs({
      url: "https://example.com/a",
      title: "A",
      content: "body",
    });

    // Assert
    expect(ms).toBeNull();
  });
});

describe("classifyHostTier", () => {
  it("maps table hosts to tier1 and tier2", () => {
    // Assert
    expect(classifyHostTier("https://www.reuters.com/article")).toBe("tier1");
    expect(classifyHostTier("https://kontan.co.id/news")).toBe("tier1");
    expect(classifyHostTier("https://detik.com/finance")).toBe("tier2");
  });

  it("maps unlisted recognizable TLD hosts to tier3", () => {
    // Assert
    expect(classifyHostTier("https://example.co.id/story")).toBe("tier3");
  });

  it("maps bare IP and .xyz hosts to unknown", () => {
    // Assert
    expect(classifyHostTier("http://192.168.0.1/page")).toBe("unknown");
    expect(classifyHostTier("https://spam.xyz/article")).toBe("unknown");
  });
});

describe("extractSourceHost", () => {
  it("returns the tier table domain suffix for known publisher subdomains", () => {
    // Assert — subdomains share one diversification bucket
    expect(extractSourceHost({ url: "https://markets.reuters.com/x" })).toBe(
      "reuters.com",
    );
  });
});

describe("rankSourcesForNewsletter — tier and recency weights", () => {
  it("prefers tier1 over fresh tier3 at default weights for adjacent ranks", () => {
    // Setup
    const sourceA = makeSource({
      url: "https://reuters.com/a",
      title: "Reuters A",
      publishedAt: "2026-05-19T12:00:00.000Z",
    });
    const sourceB = makeSource({
      url: "https://example.co.id/b",
      title: "Local B",
      publishedAt: "2026-05-22T08:00:00.000Z",
    });

    // Act
    const ranked = rankSourcesForNewsletter(
      [sourceA, sourceB],
      defaultRankOpts,
    );

    // Assert
    expect(ranked[0]?.title).toBe("Reuters A");
    expect(ranked[1]?.title).toBe("Local B");
  });

  it("inverts order when recency weight dominates tier weight", () => {
    // Setup
    const sourceA = makeSource({
      url: "https://reuters.com/a",
      title: "Reuters A",
      publishedAt: "2026-05-19T12:00:00.000Z",
    });
    const sourceB = makeSource({
      url: "https://example.co.id/b",
      title: "Local B",
      publishedAt: "2026-05-22T08:00:00.000Z",
    });

    // Act
    const ranked = rankSourcesForNewsletter([sourceA, sourceB], {
      ...defaultRankOpts,
      weights: { relevance: 0.25, recency: 0.45, tier: 0.2, length: 0.1 },
    });

    // Assert
    expect(ranked[0]?.title).toBe("Local B");
    expect(ranked[1]?.title).toBe("Reuters A");
  });
});

describe("diversifyByHost — host cap", () => {
  it("caps each host at maxPerHost then spillover-fills by score", () => {
    // Setup — 6 reuters + 4 kontan, scores decrease with index
    const sources: SourceForGeneration[] = [];
    for (let i = 0; i < 6; i += 1) {
      sources.push(
        makeSource({
          url: `https://reuters.com/r${String(i)}`,
          title: `Reuters ${String(i)}`,
          content: "x".repeat(1500 - i),
        }),
      );
    }
    for (let i = 0; i < 4; i += 1) {
      sources.push(
        makeSource({
          url: `https://kontan.co.id/k${String(i)}`,
          title: `Kontan ${String(i)}`,
          content: "x".repeat(1400 - i),
        }),
      );
    }

    const ranked = rankSourcesForNewsletter(sources, defaultRankOpts);

    // Act
    const selected = diversifyByHost(ranked, { maxPerHost: 2, limit: 6 });

    // Assert — 2 capped reuters, 2 capped kontan, then 2 spillover reuters
    const hosts = selected.map((s) => extractSourceHost(s));
    expect(hosts.filter((h) => h === "reuters.com")).toHaveLength(4);
    expect(hosts.filter((h) => h === "kontan.co.id")).toHaveLength(2);
    expect(selected).toHaveLength(6);
    expect(selected[0]?.title).toBe("Reuters 0");
    expect(selected[1]?.title).toBe("Reuters 1");
    expect(selected[2]?.title).toBe("Kontan 0");
    expect(selected[3]?.title).toBe("Kontan 1");
    expect(selected[4]?.title).toBe("Reuters 2");
    expect(selected[5]?.title).toBe("Reuters 3");
  });
});

describe("buildSourceMixObservability", () => {
  it("summarizes host list, tier counts, and recency median", () => {
    // Setup
    const ranked = rankSourcesForNewsletter(
      [
        makeSource({
          url: "https://reuters.com/a",
          title: "A",
          publishedAt: "2026-05-21T12:00:00.000Z",
        }),
        makeSource({
          url: "https://detik.com/b",
          title: "B",
          publishedAt: "2026-05-20T12:00:00.000Z",
        }),
      ],
      defaultRankOpts,
    );

    // Act
    const summary = buildSourceMixObservability("ticker-1", ranked);

    // Assert
    expect(summary.tickerId).toBe("ticker-1");
    expect(summary.selectedHosts).toEqual(["reuters.com", "detik.com"]);
    expect(summary.hostTierDistribution.tier1).toBe(1);
    expect(summary.hostTierDistribution.tier2).toBe(1);
    expect(summary.recencyP50Hours).toBe(36);
  });
});
