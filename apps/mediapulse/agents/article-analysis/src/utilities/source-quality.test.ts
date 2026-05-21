/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  classifyHostTier,
  computeSourceQuality,
  contentLengthScore,
  hostClassScore,
  recencyScore,
  structuralScore,
} from "./source-quality.js";

const NOW = new Date("2026-06-01T12:00:00.000Z");

describe("hostClassScore", () => {
  it("scores tier-1 Reuters URLs including subdomains", () => {
    expect(hostClassScore("https://www.reuters.com/business/123")).toBe(0.9);
    expect(hostClassScore("https://markets.reuters.com/x")).toBe(0.9);
  });

  it("returns neutral score for unknown hosts", () => {
    expect(hostClassScore("https://random-blog.example.com/post")).toBe(0.5);
  });

  it("classifies tier-2 and tier-3 hosts", () => {
    expect(classifyHostTier("https://www.cnbc.com/article")).toBe("tier2");
    expect(classifyHostTier("https://name.substack.com/p/slug")).toBe("tier3");
  });
});

describe("recencyScore", () => {
  it("returns 1.0 at zero age and ~0.368 after one half-life", () => {
    const fresh = recencyScore({ publishedAt: NOW, createdAt: NOW }, NOW, 72);
    expect(fresh.score).toBe(1);
    expect(fresh.ageHours).toBe(0);

    const halfLife = new Date(NOW.getTime() - 72 * 3_600_000);
    const aged = recencyScore(
      { publishedAt: halfLife, createdAt: NOW },
      NOW,
      72,
    );
    expect(aged.score).toBeCloseTo(Math.exp(-1), 3);
    expect(aged.ageHours).toBeCloseTo(72, 1);
  });

  it("returns neutral 0.5 when no reference dates exist", () => {
    const neutral = recencyScore({}, NOW, 72);
    expect(neutral.score).toBe(0.5);
    expect(neutral.ageHours).toBeNull();
  });
});

describe("structuralScore", () => {
  it("rewards moderate-length articles with paragraph breaks and sane casing", () => {
    const paragraphs = Array.from({ length: 5 }, (_, index) =>
      `Paragraph ${String(index)} with normal mixed case financial commentary.`.repeat(
        12,
      ),
    ).join("\n\n");
    const body = paragraphs.slice(0, 3000);

    expect(
      structuralScore({ title: "Headline", content: body }),
    ).toBeGreaterThanOrEqual(0.85);
  });

  it("penalizes short ALL-CAPS press-release stubs", () => {
    const shouting = "BREAKING: COMPANY ANNOUNCES DEAL ".repeat(4);
    expect(
      structuralScore({ title: "PRESS RELEASE", content: shouting }),
    ).toBeLessThanOrEqual(0.3);
  });
});

describe("computeSourceQuality", () => {
  it("combines host, recency, and structural subscores into [0, 1]", () => {
    const score = computeSourceQuality(
      {
        url: "https://www.reuters.com/markets/story",
        title: "Markets update",
        content: Array.from({ length: 5 }, (_, index) =>
          `Paragraph ${String(index)} with earnings and revenue context in normal case.`.repeat(
            15,
          ),
        ).join("\n\n"),
        createdAt: new Date(NOW.getTime() - 2 * 3_600_000),
        publishedAt: new Date(NOW.getTime() - 2 * 3_600_000),
      },
      { now: NOW, recencyHalfLifeHours: 72 },
    );

    expect(score).toBeGreaterThan(0.8);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("scores stale unknown blogs lower than fresh tier-1 wire copy", () => {
    const reuters = computeSourceQuality(
      {
        url: "https://www.reuters.com/business/123",
        title: "Wire headline",
        content: validArticleBody(),
        createdAt: new Date(NOW.getTime() - 2 * 3_600_000),
        publishedAt: new Date(NOW.getTime() - 2 * 3_600_000),
      },
      { now: NOW },
    );
    const blog = computeSourceQuality(
      {
        url: "https://random-blog.example.com/opinion",
        title: "Blog take",
        content: "OLD BLOG RUMOR POST ".repeat(8),
        createdAt: new Date(NOW.getTime() - 14 * 24 * 3_600_000),
        publishedAt: new Date(NOW.getTime() - 14 * 24 * 3_600_000),
      },
      { now: NOW },
    );

    expect(reuters).toBeGreaterThan(blog);
    expect(blog).toBeLessThan(0.4);
  });
});

/** Builds a ~3k-char article body with paragraph breaks for structural tests. */
const validArticleBody = (): string =>
  Array.from({ length: 5 }, (_, index) =>
    `Paragraph ${String(index)} discusses earnings, revenue, and market context in normal case.`.repeat(
      14,
    ),
  ).join("\n\n");

describe("contentLengthScore", () => {
  it("peaks between 1500 and 8000 characters", () => {
    expect(contentLengthScore(3000)).toBe(1);
    expect(contentLengthScore(100)).toBe(0.2);
    expect(contentLengthScore(20_000)).toBe(0.6);
  });
});
