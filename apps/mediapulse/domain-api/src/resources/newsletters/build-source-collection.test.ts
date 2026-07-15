import { describe, expect, it, vi } from "vitest";

import { buildSourceCollection } from "./build-source-collection";

const citationRow = (overrides: {
  dataSourceId: string;
  title: string;
  url: string;
  sectionKey?: string;
  searchQueryId: string | null;
  source?: string | null;
  fetchedAt?: Date | null;
  createdAt?: Date;
}) => ({
  sectionKey: overrides.sectionKey ?? "industryPulse",
  dataSource: {
    id: overrides.dataSourceId,
    url: overrides.url,
    title: overrides.title,
    source: overrides.source ?? null,
    fetchedAt: overrides.fetchedAt ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-07-13T06:00:00.000Z"),
    searchQueryId: overrides.searchQueryId,
  },
});

describe("buildSourceCollection", () => {
  it("queries citations scoped to the newsletter", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany },
    });

    expect(findMany.mock.calls[0]?.[0]?.where).toEqual({
      newsletterId: "nl-1",
    });
    expect(result).toStrictEqual({
      totalLabel: "0",
      dataCollectionLabel: "0",
      pageCollectionLabel: "0",
      publishersLabel: "0",
      sources: [],
    });
  });

  it("buckets cited sources by collector and counts distinct publishers", async () => {
    const findMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-1",
        title: "Reuters scoop",
        url: "https://reuters.com/a",
        searchQueryId: "sq-1",
        source: "Reuters",
        fetchedAt: new Date("2026-07-13T09:00:00.000Z"),
      }),
      citationRow({
        dataSourceId: "ds-2",
        title: "Bloomberg brief",
        url: "https://bloomberg.com/b",
        searchQueryId: "sq-2",
        source: "Reuters",
      }),
      citationRow({
        dataSourceId: "ds-3",
        title: "Curated listing item",
        url: "https://curated.example/c",
        searchQueryId: null,
        source: "Curated Times",
      }),
    ]);

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany },
    });

    expect(result.totalLabel).toBe("3");
    expect(result.dataCollectionLabel).toBe("2");
    expect(result.pageCollectionLabel).toBe("1");
    expect(result.publishersLabel).toBe("2");
  });

  it("orders sources by collector then title, with publisher and collected date in meta", async () => {
    const findMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-page",
        title: "Zeta curated",
        url: "https://curated.example/z",
        searchQueryId: null,
        source: "Curated Times",
        fetchedAt: new Date("2026-07-13T09:00:00.000Z"),
      }),
      citationRow({
        dataSourceId: "ds-data",
        title: "Alpha search hit",
        url: "https://reuters.com/a",
        searchQueryId: "sq-1",
        source: "Reuters",
        fetchedAt: new Date("2026-07-13T09:00:00.000Z"),
      }),
    ]);

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany },
    });

    expect(result.sources.map((source) => source.id)).toStrictEqual([
      "ds-data",
      "ds-page",
    ]);
    expect(result.sources[0]).toStrictEqual({
      id: "ds-data",
      title: "Alpha search hit",
      url: "https://reuters.com/a",
      collectorLabel: "Data Collection",
      meta: "Reuters · Jul 13, 2026",
    });
  });

  it("deduplicates a source cited in several sections and falls back to the url host", async () => {
    const findMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-1",
        title: "Multi-section piece",
        url: "https://www.example.com/story",
        sectionKey: "industryPulse",
        searchQueryId: "sq-1",
        source: null,
        fetchedAt: null,
        createdAt: new Date("2026-07-12T00:00:00.000Z"),
      }),
      citationRow({
        dataSourceId: "ds-1",
        title: "Multi-section piece",
        url: "https://www.example.com/story",
        sectionKey: "quickHits",
        searchQueryId: "sq-1",
        source: null,
      }),
    ]);

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany },
    });

    expect(result.totalLabel).toBe("1");
    expect(result.sources[0]?.meta).toBe("example.com · Jul 12, 2026");
  });
});
