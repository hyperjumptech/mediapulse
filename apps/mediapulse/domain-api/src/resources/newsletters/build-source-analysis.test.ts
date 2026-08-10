import { describe, expect, it, vi } from "vitest";

import { buildSourceAnalysis } from "./build-source-analysis";

const citationRow = (overrides: {
  dataSourceId: string;
  title: string;
  url: string;
  section?: string | null;
  sectionScore?: number | null;
  sectionReason?: string | null;
  articleAnalysisRunId?: string | null;
  sectionKey?: string;
  sectionScoreBreakdown?: unknown;
  registrableDomain?: string | null;
}) => ({
  sectionKey: overrides.sectionKey ?? "industryPulse",
  dataSource: {
    id: overrides.dataSourceId,
    url: overrides.url,
    title: overrides.title,
    registrableDomain: overrides.registrableDomain ?? null,
    tickerSections:
      overrides.section === undefined &&
      overrides.articleAnalysisRunId === undefined
        ? []
        : [
            {
              section: overrides.section ?? null,
              sectionScore: overrides.sectionScore ?? null,
              sectionReason: overrides.sectionReason ?? null,
              sectionScoreBreakdown: overrides.sectionScoreBreakdown ?? null,
              articleAnalysisRunId: overrides.articleAnalysisRunId ?? null,
            },
          ],
  },
});

const runRow = (overrides: {
  id: string;
  model?: string | null;
  agentVersion?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  completedAt?: Date | null;
  startedAt?: Date;
}) => ({
  id: overrides.id,
  startedAt: overrides.startedAt ?? new Date("2026-07-13T05:00:00.000Z"),
  completedAt:
    overrides.completedAt === undefined
      ? new Date("2026-07-13T06:00:00.000Z")
      : overrides.completedAt,
  model: overrides.model ?? null,
  agentVersion: overrides.agentVersion ?? null,
  promptTokens: overrides.promptTokens ?? 0,
  completionTokens: overrides.completionTokens ?? 0,
  reasoningTokens: overrides.reasoningTokens ?? 0,
  totalTokens: overrides.totalTokens ?? 0,
});

const rejectedRow = (overrides: {
  dataSourceId: string;
  title: string;
  url: string;
  runId: string;
  sectionReason?: string | null;
}) => ({
  sectionReason: overrides.sectionReason ?? null,
  articleAnalysisRunId: overrides.runId,
  dataSource: {
    id: overrides.dataSourceId,
    url: overrides.url,
    title: overrides.title,
  },
});

describe("buildSourceAnalysis", () => {
  it("scopes the query to the newsletter and skips runs and rejects when unlinked", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([]);
    const runFindMany = vi.fn();
    const rejectedFindMany = vi.fn();

    const result = await buildSourceAnalysis("nl-1", "tk-1", {
      newsletterCitation: { findMany: citationFindMany },
      articleAnalysisRun: { findMany: runFindMany },
      dataSourceTickerSection: { findMany: rejectedFindMany },
      domainAuthority: { findMany: vi.fn().mockResolvedValue([]) },
    });

    expect(citationFindMany.mock.calls[0]?.[0]?.where).toEqual({
      newsletterId: "nl-1",
    });
    expect(runFindMany).not.toHaveBeenCalled();
    expect(rejectedFindMany).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      agentLabel: "article-analysis",
      generatedAtLabel: "—",
      modelLabel: "—",
      tokensTotalLabel: "0",
      tokensBreakdownLabel: "Input 0 · Output 0 · Reasoning 0",
      assigned: [],
      rejected: [],
    });
  });

  it("builds KPIs, versioned assigned articles, and rejected articles from the exact runs", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-a",
        title: "Alpha assigned",
        url: "https://reuters.com/a",
        section: "dealsAndMovements",
        sectionScore: 0.9,
        sectionReason: "Direct M&A coverage of the issuer.",
        articleAnalysisRunId: "run-1",
      }),
      citationRow({
        dataSourceId: "ds-b",
        title: "Beta assigned",
        url: "https://reuters.com/b",
        section: "industryPulse",
        sectionScore: 0.6,
        sectionReason: "Broad sector trend.",
        articleAnalysisRunId: "run-1",
      }),
    ]);
    const runFindMany = vi.fn().mockResolvedValue([
      runRow({
        id: "run-1",
        model: "claude-opus-4-8",
        agentVersion: "4.0.0",
        promptTokens: 1200,
        completionTokens: 300,
        reasoningTokens: 150,
        totalTokens: 1500,
        completedAt: new Date("2026-07-13T06:00:00.000Z"),
      }),
    ]);
    const rejectedFindMany = vi.fn().mockResolvedValue([
      rejectedRow({
        dataSourceId: "ds-r",
        title: "Rejected piece",
        url: "https://blog.example/r",
        runId: "run-1",
        sectionReason: "No fit for any newsletter section.",
      }),
    ]);

    const result = await buildSourceAnalysis("nl-1", "tk-1", {
      newsletterCitation: { findMany: citationFindMany },
      articleAnalysisRun: { findMany: runFindMany },
      dataSourceTickerSection: { findMany: rejectedFindMany },
      domainAuthority: { findMany: vi.fn().mockResolvedValue([]) },
    });

    expect(runFindMany.mock.calls[0]?.[0]?.where).toEqual({
      id: { in: ["run-1"] },
    });
    expect(rejectedFindMany.mock.calls[0]?.[0]?.where).toEqual({
      tickerId: "tk-1",
      section: null,
      articleAnalysisRunId: { in: ["run-1"] },
    });
    expect(result.agentLabel).toBe("article-analysis - 4.0.0");
    expect(result.generatedAtLabel).toBe("July 13, 2026 at 13:00");
    expect(result.modelLabel).toBe("claude-opus-4-8");
    expect(result.tokensTotalLabel).toBe("1.5K");
    expect(result.tokensBreakdownLabel).toBe(
      "Input 1,200 · Output 300 · Reasoning 150",
    );

    expect(result.assigned).toStrictEqual([
      {
        id: "ds-b",
        title: "Beta assigned",
        url: "https://reuters.com/b",
        sectionLabel: "Industry Pulse",
        score: 0.6,
        scoreLabel: "0.6",
        scoreLine: "0.6 - Industry Pulse",
        scoreVariant: "warning",
        reason: "Broad sector trend.",
        sectionScores: [],
        publisher: "—",
        publisherAuthorityLabel: "—",
      },
      {
        id: "ds-a",
        title: "Alpha assigned",
        url: "https://reuters.com/a",
        sectionLabel: "Deals & Movements",
        score: 0.9,
        scoreLabel: "0.9",
        scoreLine: "0.9 - Deals & Movements",
        scoreVariant: "success",
        reason: "Direct M&A coverage of the issuer.",
        sectionScores: [],
        publisher: "—",
        publisherAuthorityLabel: "—",
      },
    ]);
    expect(result.rejected).toStrictEqual([
      {
        id: "ds-r",
        title: "Rejected piece",
        url: "https://blog.example/r",
        reason: "No fit for any newsletter section.",
      },
    ]);
  });

  it("expands the stored breakdown into a per-section score list", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-a",
        title: "Alpha assigned",
        url: "https://reuters.com/a",
        section: "competitiveLandscape",
        sectionScore: 0.4,
        sectionReason: "Competitive Landscape — matched 2/5.",
        articleAnalysisRunId: "run-1",
        sectionScoreBreakdown: {
          section: "competitiveLandscape",
          sections: [
            { section: "industryPulse", matched: 2, total: 7 },
            { section: "competitiveLandscape", matched: 2, total: 5 },
          ],
          criteria: [
            {
              id: "ip-macro-move",
              section: "industryPulse",
              text: "Include if macro.",
              matched: true,
              note: "National policy shift.",
            },
            {
              id: "cl-peer-named",
              section: "competitiveLandscape",
              text: "Include if a peer is named.",
              matched: false,
              note: "No competitor named.",
            },
          ],
        },
      }),
    ]);
    const runFindMany = vi
      .fn()
      .mockResolvedValue([runRow({ id: "run-1", agentVersion: "4.0.0" })]);
    const rejectedFindMany = vi.fn().mockResolvedValue([]);

    const result = await buildSourceAnalysis("nl-1", "tk-1", {
      newsletterCitation: { findMany: citationFindMany },
      articleAnalysisRun: { findMany: runFindMany },
      dataSourceTickerSection: { findMany: rejectedFindMany },
      domainAuthority: { findMany: vi.fn().mockResolvedValue([]) },
    });
    const scores = result.assigned[0]?.sectionScores ?? [];

    expect(scores.map((entry) => entry.scoreLine)).toEqual([
      "0.40 - Competitive Landscape",
      "0.29 - Industry Pulse",
    ]);
    expect(scores[0]?.isSelected).toBe(true);
    expect(scores[1]?.isSelected).toBe(false);
    expect(scores[0]?.reason).toBe(
      [
        "Matched 2 of 5",
        "",
        "Missed 1",
        "\u2022 cl-peer-named: No competitor named.",
      ].join("\n"),
    );
    expect(scores[1]?.reason).toBe("Matched 2 of 7\n\u2022 ip-macro-move");
  });

  it("shows the publisher and its cached authority", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-1",
        title: "Assigned",
        url: "https://finance.detik.com/a",
        registrableDomain: "detik.com",
        section: "industryPulse",
        sectionScore: 0.5,
        sectionReason: "Sector news.",
        articleAnalysisRunId: "run-1",
      }),
    ]);
    const domainAuthorityFindMany = vi
      .fn()
      .mockResolvedValue([{ domain: "detik.com", openPageRank: 8.03 }]);

    const result = await buildSourceAnalysis("nl-1", "tk-1", {
      newsletterCitation: { findMany: citationFindMany },
      articleAnalysisRun: { findMany: vi.fn().mockResolvedValue([]) },
      dataSourceTickerSection: { findMany: vi.fn().mockResolvedValue([]) },
      domainAuthority: { findMany: domainAuthorityFindMany },
    });

    expect(domainAuthorityFindMany.mock.calls[0]?.[0].where.domain.in).toEqual([
      "detik.com",
    ]);
    expect(result.assigned[0]?.publisher).toBe("detik.com");
    expect(result.assigned[0]?.publisherAuthorityLabel).toBe("8.03");
  });

  it("falls back to a dash when the publisher has no cached authority", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-1",
        title: "Assigned",
        url: "https://unknown.test/a",
        registrableDomain: "unknown.test",
        section: "industryPulse",
        sectionScore: 0.5,
        sectionReason: "Sector news.",
        articleAnalysisRunId: "run-1",
      }),
    ]);

    const result = await buildSourceAnalysis("nl-1", "tk-1", {
      newsletterCitation: { findMany: citationFindMany },
      articleAnalysisRun: { findMany: vi.fn().mockResolvedValue([]) },
      dataSourceTickerSection: { findMany: vi.fn().mockResolvedValue([]) },
      domainAuthority: { findMany: vi.fn().mockResolvedValue([]) },
    });

    expect(result.assigned[0]?.publisher).toBe("unknown.test");
    expect(result.assigned[0]?.publisherAuthorityLabel).toBe("—");
  });

  it("leaves agent labels unversioned when the linked run is missing", async () => {
    const citationFindMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "ds-1",
        title: "Orphan assigned",
        url: "https://reuters.com/a",
        section: "industryPulse",
        sectionScore: 0.5,
        sectionReason: "Sector news.",
        articleAnalysisRunId: "run-missing",
      }),
    ]);
    const runFindMany = vi.fn().mockResolvedValue([]);
    const rejectedFindMany = vi.fn().mockResolvedValue([]);

    const result = await buildSourceAnalysis("nl-1", "tk-1", {
      newsletterCitation: { findMany: citationFindMany },
      articleAnalysisRun: { findMany: runFindMany },
      dataSourceTickerSection: { findMany: rejectedFindMany },
      domainAuthority: { findMany: vi.fn().mockResolvedValue([]) },
    });

    expect(result.assigned).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.agentLabel).toBe("article-analysis");
    expect(result.generatedAtLabel).toBe("—");
    expect(result.modelLabel).toBe("—");
  });
});
