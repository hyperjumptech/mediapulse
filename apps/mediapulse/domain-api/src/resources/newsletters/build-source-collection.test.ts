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
  agentVersion?: string | null;
  searchCredits?: number;
  byProvider?: Record<string, number>;
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
    ...(overrides.agentVersion ? { agentVersion: overrides.agentVersion } : {}),
    cost: {
      searchCredits: overrides.searchCredits ?? 0,
      searchCreditsByProvider: overrides.byProvider ?? {},
    },
  },
});

const outcomeRow = (overrides: {
  id: string;
  url: string;
  runId: string;
  agent: string;
  reason?: string | null;
  reasonDetail?: string | null;
}) => ({
  id: overrides.id,
  url: overrides.url,
  runId: overrides.runId,
  agent: overrides.agent,
  reason: overrides.reason ?? null,
  reasonDetail: overrides.reasonDetail ?? null,
});

describe("buildSourceCollection", () => {
  it("scopes the query to the newsletter and skips runs and outcomes when unlinked", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([]);
    const runFindMany = vi.fn();
    const outcomeFindMany = vi.fn();

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany: citationFindMany },
      dataCollectionRun: { findMany: runFindMany },
      collectionUrlOutcome: { findMany: outcomeFindMany },
    });

    expect(citationFindMany.mock.calls[0]?.[0]?.where).toEqual({
      newsletterId: "nl-1",
    });
    expect(runFindMany).not.toHaveBeenCalled();
    expect(outcomeFindMany).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      generatedAtLabel: "—",
      creditsTotalLabel: "0",
      creditsBreakdownLabel: "No cost recorded",
      collectedTotalLabel: "0",
      droppedTotalLabel: "0",
      sources: [],
      dropped: [],
    });
  });

  it("builds KPIs, versioned collected sources, and dropped URLs from the exact runs", async () => {
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
        agentVersion: "1.0.0",
        searchCredits: 42,
        byProvider: { serper: 30, tavily: 12 },
        completedAt: new Date("2026-07-13T06:00:00.000Z"),
      }),
      runRow({
        id: "run-page",
        agentVersion: "2.0.0",
        searchCredits: 0,
        completedAt: new Date("2026-07-12T06:00:00.000Z"),
      }),
    ]);
    const outcomeFindMany = vi.fn().mockResolvedValue([
      outcomeRow({
        id: "o1",
        url: "https://old.example/x",
        runId: "run-data",
        agent: "data_collection",
        reason: "freshness_too_old",
        reasonDetail: "Published 2019-03-12, older than the 30-day window",
      }),
      outcomeRow({
        id: "o2",
        url: "https://dupe.example/y",
        runId: "run-page",
        agent: "page_collection",
        reason: "duplicate",
      }),
    ]);

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany: citationFindMany },
      dataCollectionRun: { findMany: runFindMany },
      collectionUrlOutcome: { findMany: outcomeFindMany },
    });

    expect(outcomeFindMany.mock.calls[0]?.[0]?.where).toEqual({
      runId: { in: ["run-data", "run-page"] },
      status: { in: ["dropped", "failed"] },
    });
    expect(result.generatedAtLabel).toBe("July 13, 2026 at 13:00");
    expect(result.creditsTotalLabel).toBe("42");
    expect(result.creditsBreakdownLabel).toBe("Serper 30 · Tavily 12");
    expect(result.collectedTotalLabel).toBe("2");
    expect(result.droppedTotalLabel).toBe("2");

    expect(result.sources).toStrictEqual([
      {
        id: "ds-data",
        title: "Alpha search hit",
        url: "https://reuters.com/a",
        agentLine: "From Data Collection 1.0.0",
        queryText: "bank earnings",
      },
      {
        id: "ds-page",
        title: "Zeta curated",
        url: "https://curated.example/z",
        agentLine: "From Page Collection 2.0.0",
        queryText: "Curated source",
      },
    ]);
    expect(result.dropped).toStrictEqual([
      {
        id: "o1",
        url: "https://old.example/x",
        agentLine: "From Data Collection 1.0.0",
        reason: "freshness_too_old",
        reasonDetail: "Published 2019-03-12, older than the 30-day window",
      },
      {
        id: "o2",
        url: "https://dupe.example/y",
        agentLine: "From Page Collection 2.0.0",
        reason: "duplicate",
        reasonDetail: "",
      },
    ]);
  });

  it("leaves agent labels unversioned when the linked run is missing", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-1",
        title: "Multi-section piece",
        url: "https://reuters.com/a",
        sectionKey: "industryPulse",
        searchQueryId: "sq-1",
        queryText: "earnings",
        dataCollectionRunId: "run-missing",
      }),
      citationRow({
        dataSourceId: "ds-1",
        title: "Multi-section piece",
        url: "https://reuters.com/a",
        sectionKey: "quickHits",
        searchQueryId: "sq-1",
        queryText: "earnings",
        dataCollectionRunId: "run-missing",
      }),
    ]);
    const runFindMany = vi.fn().mockResolvedValue([]);
    const outcomeFindMany = vi.fn().mockResolvedValue([]);

    const result = await buildSourceCollection("nl-1", {
      newsletterCitation: { findMany: citationFindMany },
      dataCollectionRun: { findMany: runFindMany },
      collectionUrlOutcome: { findMany: outcomeFindMany },
    });

    expect(result.collectedTotalLabel).toBe("1");
    expect(result.droppedTotalLabel).toBe("0");
    expect(result.sources[0]?.agentLine).toBe("From Data Collection");
    expect(result.generatedAtLabel).toBe("—");
  });
});
