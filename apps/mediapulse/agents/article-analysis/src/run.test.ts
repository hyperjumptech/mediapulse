/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { articleAnalysisConfigSchema } from "./config-schema.js";

const analysisGet = vi.fn();
const analysisCreate = vi.fn();
const articleAnalysisRunCreate = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    analysis: {
      get: analysisGet,
      create: analysisCreate,
    },
    articleAnalysisRun: {
      create: articleAnalysisRunCreate,
    },
  })),
}));

vi.mock("@mediapulse/env/agents-article-analysis", () => ({
  env: {
    AGENT_DATA_API_URL: "http://localhost:8081",
    AGENT_AUTH_API_URL: "http://localhost:8080",
    AGENT_REGISTRY_URL: "http://localhost:8082",
    PORT: 4010,
  },
}));

vi.mock("@workspace/logger", () => ({
  logger: {
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./llm-classify-section.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./llm-classify-section.js")>();

  return {
    ...actual,
    classifyArticleSection: vi.fn(),
  };
});

import { run } from "./run.js";
import { classifyArticleSection } from "./llm-classify-section.js";

const config = articleAnalysisConfigSchema.parse({});

const TICKER = {
  symbol: "BBCA",
  name: "Bank Central Asia",
  sector: null,
  industry: null,
  subIndustry: null,
  businessActivity: null,
};

const EMPTY_SOURCE = {
  id: "11111111-1111-4111-8111-111111111111",
  tickerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  url: "https://example.com/empty",
  title: "Empty",
  description: null,
  content: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ticker: TICKER,
};

const DESCRIBED_SOURCE = {
  id: "22222222-2222-4222-8222-222222222222",
  tickerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  url: "https://example.com/described",
  title: "Described",
  description: "Bank Central Asia posts record profit",
  content: null,
  createdAt: new Date("2026-01-02T00:00:00Z"),
  ticker: TICKER,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("article-analysis run — empty-source skip and description classification", () => {
  it("skips the LLM for a source with no description or content and marks it rejected", async () => {
    analysisGet
      .mockResolvedValueOnce({
        dataSources: [EMPTY_SOURCE, DESCRIBED_SOURCE],
        dataSourceTotalCount: 2,
      })
      .mockResolvedValueOnce({ dataSources: [], dataSourceTotalCount: 0 });
    analysisCreate.mockResolvedValue({
      articlesScored: 2,
      articlesRejected: 1,
      skippedByCap: 0,
      cappedTickerCount: 0,
    });
    (classifyArticleSection as ReturnType<typeof vi.fn>).mockResolvedValue({
      section: "industryPulse",
      score: 0.4,
      reason: "matched",
      scoreBreakdown: {
        section: "industryPulse",
        matched: 2,
        total: 5,
        criteriaHash: "hash",
        criteria: [],
        sections: [],
      },
    });

    await run({
      input: {},
      config,
      token: "Bearer test",
      contract: { brief: "Focus on banks.", version: "v1" },
    });

    expect(classifyArticleSection).toHaveBeenCalledTimes(1);
    const call = (classifyArticleSection as ReturnType<typeof vi.fn>).mock
      .calls[0]![0];

    expect(call.content).toBe("Bank Central Asia posts record profit");
    expect(call.brief).toBe("Focus on banks.");

    const posted = analysisCreate.mock.calls[0]![0];
    const emptyRow = posted.articleSections.find(
      (row: { dataSourceId: string }) => row.dataSourceId === EMPTY_SOURCE.id,
    );

    expect(emptyRow.section).toBeNull();
    expect(posted.analyzedDataSourceIds).toEqual(
      expect.arrayContaining([EMPTY_SOURCE.id, DESCRIBED_SOURCE.id]),
    );
  });

  it("does not thread a brief when no contract is attached", async () => {
    analysisGet
      .mockResolvedValueOnce({
        dataSources: [DESCRIBED_SOURCE],
        dataSourceTotalCount: 1,
      })
      .mockResolvedValueOnce({ dataSources: [], dataSourceTotalCount: 0 });
    analysisCreate.mockResolvedValue({
      articlesScored: 1,
      articlesRejected: 0,
      skippedByCap: 0,
      cappedTickerCount: 0,
    });
    (classifyArticleSection as ReturnType<typeof vi.fn>).mockResolvedValue({
      section: "industryPulse",
      score: 0.4,
      reason: "matched",
      scoreBreakdown: {
        section: "industryPulse",
        matched: 2,
        total: 5,
        criteriaHash: "hash",
        criteria: [],
        sections: [],
      },
    });

    await run({
      input: {},
      config,
      token: "Bearer test",
    });

    const call = (classifyArticleSection as ReturnType<typeof vi.fn>).mock
      .calls[0]![0];

    expect(call.brief).toBeUndefined();
  });

  it("aggregates cap counts across batches into the run summary", async () => {
    const secondSource = {
      ...DESCRIBED_SOURCE,
      id: "33333333-3333-4333-8333-333333333333",
    };
    analysisGet
      .mockResolvedValueOnce({
        dataSources: [DESCRIBED_SOURCE],
        dataSourceTotalCount: 2,
      })
      .mockResolvedValueOnce({
        dataSources: [secondSource],
        dataSourceTotalCount: 1,
      })
      .mockResolvedValueOnce({ dataSources: [], dataSourceTotalCount: 0 });
    analysisCreate
      .mockResolvedValueOnce({
        articlesScored: 1,
        articlesRejected: 0,
        skippedByCap: 3,
        cappedTickerCount: 1,
      })
      .mockResolvedValueOnce({
        articlesScored: 1,
        articlesRejected: 0,
        skippedByCap: 4,
        cappedTickerCount: 2,
      });
    (classifyArticleSection as ReturnType<typeof vi.fn>).mockResolvedValue({
      section: "industryPulse",
      score: 0.4,
      reason: "matched",
      scoreBreakdown: {
        section: "industryPulse",
        matched: 2,
        total: 5,
        criteriaHash: "hash",
        criteria: [],
        sections: [],
      },
    });

    const result = await run({
      input: {},
      config,
      token: "Bearer test",
    });

    expect(result.details).toEqual(
      expect.objectContaining({ skippedByCap: 7, cappedTickers: 3 }),
    );
  });
});
