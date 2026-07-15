import { describe, expect, it, vi } from "vitest";

import { buildSourceCollection } from "./build-source-collection";

const citationRow = (overrides: {
  dataSourceId: string;
  title: string;
  url: string;
  sectionKey?: string;
  searchQueryId: string | null;
  queryText?: string;
  dataCollectionRunId?: string | null;
}) => ({
  sectionKey: overrides.sectionKey ?? "industryPulse",
  dataSource: {
    id: overrides.dataSourceId,
    url: overrides.url,
    title: overrides.title,
    searchQueryId: overrides.searchQueryId,
    dataCollectionRunId: overrides.dataCollectionRunId ?? null,
    searchQuery: overrides.queryText ? { text: overrides.queryText } : null,
  },
});

const runRow = (overrides: {
  id: string;
  agentId?: string | null;
  agentVersion?: string | null;
  searchCredits?: number;
  completedAt?: Date | null;
  startedAt?: Date;
}) => ({
  id: overrides.id,
  startedAt: overrides.startedAt ?? new Date("2026-07-13T05:00:00.000Z"),
  completedAt:
    overrides.completedAt === undefined
      ? new Date("2026-07-13T06:00:00.000Z")
      : overrides.completedAt,
  snapshot: {
    ...(overrides.agentId === null
      ? {}
      : { agentId: overrides.agentId ?? "data-collection" }),
    ...(overrides.agentVersion ? { agentVersion: overrides.agentVersion } : {}),
    cost: { searchCredits: overrides.searchCredits ?? 0 },
  },
});

describe("buildSourceCollection", () => {
  it("queries citations scoped to the newsletter and skips runs when unlinked", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([]);
    const runFindMany = vi.fn();

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany: citationFindMany },
      dataCollectionRun: { findMany: runFindMany },
    });

    expect(citationFindMany.mock.calls[0]?.[0]?.where).toEqual({
      newsletterId: "nl-1",
    });
    expect(runFindMany).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      agentsLabel: "—",
      generatedAtLabel: "—",
      creditsTotalLabel: "0",
      creditsBreakdownLabel: "No cost recorded",
      totalLabel: "0",
      sources: [],
    });
  });

  it("builds stage KPIs from the runs behind the cited sources", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-data",
        title: "Alpha search hit",
        url: "https://reuters.com/a",
        searchQueryId: "sq-1",
        queryText: "bank earnings",
        dataCollectionRunId: "run-data",
      }),
      citationRow({
        dataSourceId: "ds-page",
        title: "Zeta curated",
        url: "https://curated.example/z",
        searchQueryId: null,
        dataCollectionRunId: "run-page",
      }),
    ]);
    const runFindMany = vi.fn().mockResolvedValue([
      runRow({
        id: "run-data",
        agentId: "data-collection",
        agentVersion: "1.0.0",
        searchCredits: 42,
        completedAt: new Date("2026-07-13T06:00:00.000Z"),
      }),
      runRow({
        id: "run-page",
        agentId: "page-collection",
        agentVersion: "2.0.0",
        searchCredits: 0,
        completedAt: new Date("2026-07-12T06:00:00.000Z"),
      }),
    ]);

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany: citationFindMany },
      dataCollectionRun: { findMany: runFindMany },
    });

    expect(runFindMany.mock.calls[0]?.[0]?.where).toEqual({
      id: { in: ["run-data", "run-page"] },
    });
    expect(result.agentsLabel).toBe(
      "data-collection - 1.0.0 · page-collection - 2.0.0",
    );
    expect(result.generatedAtLabel).toBe("July 13, 2026 at 13:00");
    expect(result.creditsTotalLabel).toBe("42");
    expect(result.creditsBreakdownLabel).toBe(
      "Data Collection 42 · Page Collection 0",
    );
    expect(result.totalLabel).toBe("2");
  });

  it("orders results by collector then title with query text and curated fallback", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-page",
        title: "Zeta curated",
        url: "https://curated.example/z",
        searchQueryId: null,
        dataCollectionRunId: "run-page",
      }),
      citationRow({
        dataSourceId: "ds-data",
        title: "Alpha search hit",
        url: "https://reuters.com/a",
        searchQueryId: "sq-1",
        queryText: "bank earnings",
        dataCollectionRunId: "run-data",
      }),
    ]);
    const runFindMany = vi.fn().mockResolvedValue([]);

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany: citationFindMany },
      dataCollectionRun: { findMany: runFindMany },
    });

    expect(result.sources).toStrictEqual([
      {
        id: "ds-data",
        title: "Alpha search hit",
        url: "https://reuters.com/a",
        agentLabel: "Data Collection",
        queryText: "bank earnings",
      },
      {
        id: "ds-page",
        title: "Zeta curated",
        url: "https://curated.example/z",
        agentLabel: "Page Collection",
        queryText: "Curated source",
      },
    ]);
  });

  it("falls back to source collectors for the agents label when no runs are linked", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-1",
        title: "Multi-section piece",
        url: "https://reuters.com/a",
        sectionKey: "industryPulse",
        searchQueryId: "sq-1",
        queryText: "earnings",
        dataCollectionRunId: null,
      }),
      citationRow({
        dataSourceId: "ds-1",
        title: "Multi-section piece",
        url: "https://reuters.com/a",
        sectionKey: "quickHits",
        searchQueryId: "sq-1",
        queryText: "earnings",
        dataCollectionRunId: null,
      }),
    ]);
    const runFindMany = vi.fn();

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany: citationFindMany },
      dataCollectionRun: { findMany: runFindMany },
    });

    expect(runFindMany).not.toHaveBeenCalled();
    expect(result.totalLabel).toBe("1");
    expect(result.agentsLabel).toBe("Data Collection");
    expect(result.generatedAtLabel).toBe("—");
  });
});
