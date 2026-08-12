import { describe, expect, it } from "vitest";

import { truncateSources } from "./lib/truncate-sources.js";
import { selectArticles } from "./select-articles.js";
import type { SourceForGeneration } from "./types.js";

const source = (
  overrides: Partial<SourceForGeneration> & { title: string },
): SourceForGeneration => ({
  url: `https://example.com/${overrides.title.toLowerCase().replace(/\s+/g, "-")}`,
  content: "Body.",
  ...overrides,
});

describe("selectArticles", () => {
  it("breaks an equal-fit tie on publisher authority rather than arrival order", () => {
    const sources = [
      source({
        title: "Content Farm",
        section: "competitiveLandscape",
        sectionScore: 0.8,
        publisherAuthority: 1.2,
      }),
      source({
        title: "Major Daily",
        section: "competitiveLandscape",
        sectionScore: 0.8,
        publisherAuthority: 8.03,
      }),
    ];

    const { selected } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "Major Daily",
      "Content Farm",
    ]);
  });

  it("keeps arrival order when fit and authority both tie", () => {
    const sources = [
      source({
        title: "First Seen",
        section: "competitiveLandscape",
        sectionScore: 0.8,
        publisherAuthority: 5,
      }),
      source({
        title: "Second Seen",
        section: "competitiveLandscape",
        sectionScore: 0.8,
        publisherAuthority: 5,
      }),
    ];

    const { selected } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "First Seen",
      "Second Seen",
    ]);
  });

  it("never lets authority outrank a better section fit", () => {
    const sources = [
      source({
        title: "Weak Fit Strong Publisher",
        section: "competitiveLandscape",
        sectionScore: 0.6,
        publisherAuthority: 9.5,
      }),
      source({
        title: "Perfect Fit Unknown Publisher",
        section: "competitiveLandscape",
        sectionScore: 1,
      }),
    ];

    const { selected } = selectArticles(sources);

    expect(selected[0]?.source.title).toBe("Perfect Fit Unknown Publisher");
  });

  it("keeps the highest-scoring three articles in a section", () => {
    const sources = [
      source({
        title: "Fourth",
        section: "competitiveLandscape",
        sectionScore: 0.1,
      }),
      source({
        title: "First",
        section: "competitiveLandscape",
        sectionScore: 0.9,
      }),
      source({
        title: "Third",
        section: "competitiveLandscape",
        sectionScore: 0.5,
      }),
      source({
        title: "Second",
        section: "competitiveLandscape",
        sectionScore: 0.7,
      }),
    ];

    const { selected, report } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(report.droppedOverCap).toBe(1);
  });

  it("emits sections in canonical order regardless of input order", () => {
    const sources = [
      source({ title: "Hit", section: "quickHits", sectionScore: 0.5 }),
      source({
        title: "Deal",
        section: "dealsAndMovements",
        sectionScore: 0.5,
      }),
      source({ title: "Pulse", section: "industryPulse", sectionScore: 0.5 }),
    ];

    const { selected } = selectArticles(sources);

    expect(selected.map((entry) => entry.sectionKey)).toStrictEqual([
      "industry-pulse",
      "deals-and-movements",
      "quick-hits",
    ]);
  });

  it("drops sources with no assigned section", () => {
    const sources = [
      source({
        title: "Assigned",
        section: "industryPulse",
        sectionScore: 0.4,
      }),
      source({ title: "Unassigned", section: null, sectionScore: 0.9 }),
      source({ title: "Unknown", section: "notASection", sectionScore: 0.9 }),
    ];

    const { selected, report } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "Assigned",
    ]);
    expect(report.droppedUnassigned).toBe(2);
  });

  it("drops a source on a blocked host that was classified before the host was listed", () => {
    const sources = [
      source({
        title: "Kept",
        url: "https://market.bisnis.com/read/20260811/192/1995348/itmg",
        section: "competitiveLandscape",
        sectionScore: 0.6,
      }),
      source({
        title: "Syndication Mirror",
        url: "https://achmadnurhidayat.id/saham-bri-melonjak-pembelian-asing",
        section: "competitiveLandscape",
        sectionScore: 0.9,
      }),
    ];

    const { selected, report } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual(["Kept"]);
    expect(report.droppedBlockedHost).toBe(1);
  });

  it("drops an aggregator link that would not resolve for a reader", () => {
    const sources = [
      source({
        title: "Aggregator Link",
        url: "https://news.google.com/rss/articles/CBMiuwFBVV95cUxOR3Jkb0V6REY3?oc=5",
        section: "issuerPerformance",
        sectionScore: 0.8,
      }),
      source({
        title: "Publisher Article",
        url: "https://keuangan.kontan.co.id/news/pembiayaan-emas-bca-syariah-melonjak",
        section: "issuerPerformance",
        sectionScore: 0.6,
      }),
    ];

    const { selected, report } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "Publisher Article",
    ]);
    expect(report.droppedBlockedHost).toBe(1);
  });

  it("drops a reader-contributed source from Issuer Performance but keeps it elsewhere", () => {
    const sources = [
      source({
        title: "Contributed Performance",
        url: "https://www.readers.id/laba-bersih-itmg-naik-semester-i-2026",
        section: "issuerPerformance",
        sectionScore: 0.8,
      }),
      source({
        title: "Contributed Peer News",
        url: "https://www.readers.id/kinerja-emiten-kawasan-industri",
        section: "competitiveLandscape",
        sectionScore: 0.6,
      }),
    ];

    const { selected, report } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "Contributed Peer News",
    ]);
    expect(report.droppedUserGenerated).toBe(1);
    expect(report.droppedBlockedHost).toBe(0);
  });

  it("breaks score ties on input order so the result is stable", () => {
    const sources = [
      source({ title: "Earlier", section: "quickHits", sectionScore: 0.5 }),
      source({ title: "Later", section: "quickHits", sectionScore: 0.5 }),
    ];

    const { selected } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "Earlier",
      "Later",
    ]);
  });

  it("treats a missing score as zero rather than dropping the article", () => {
    const sources = [
      source({ title: "Unscored", section: "quickHits" }),
      source({ title: "Scored", section: "quickHits", sectionScore: 0.2 }),
    ];

    const { selected } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "Scored",
      "Unscored",
    ]);
  });

  it("returns nothing when no source carries a section", () => {
    const { selected, report } = selectArticles([source({ title: "Orphan" })]);

    expect(selected).toStrictEqual([]);
    expect(report.droppedUnassigned).toBe(1);
  });

  it("still breaks an equal-fit tie on authority after sources pass through truncateSources", () => {
    const sources = [
      source({
        title: "Content Farm",
        section: "competitiveLandscape",
        sectionScore: 0.6,
        publisherAuthority: 0.71,
      }),
      source({
        title: "Major Daily",
        section: "competitiveLandscape",
        sectionScore: 0.6,
        publisherAuthority: 7.46,
      }),
    ];
    const truncated = truncateSources(sources, 8000, 100000);
    const { selected } = selectArticles(truncated);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "Major Daily",
      "Content Farm",
    ]);
  });
});
