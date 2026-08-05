/** @vitest-environment node */
import type { AnalysisTickerContext } from "@workspace/agent-data-api-contract";
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

const TICKER: AnalysisTickerContext = {
  symbol: "BBCA",
  name: "Bank Central Asia",
  sector: null,
  industry: null,
  subIndustry: null,
  businessActivity: null,
  aliases: [],
  competitors: [],
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

describe("article-analysis run — input scoping", () => {
  const drainOnce = () => {
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
  };

  it("forwards tickerId to the analysis GET when the step supplies one", async () => {
    drainOnce();

    await run({
      input: { tickerId: "11111111-1111-4111-8111-111111111111" },
      config,
      token: "Bearer test",
    });

    expect(analysisGet).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: "11111111-1111-4111-8111-111111111111",
        unanalyzed: true,
      }),
    );
  });

  it("omits tickerId entirely when the step supplies none", async () => {
    drainOnce();

    await run({ input: {}, config, token: "Bearer test" });

    expect(analysisGet).toHaveBeenCalledWith(
      expect.not.objectContaining({ tickerId: expect.anything() }),
    );
  });

  it("caps the requested limit at the batch size", async () => {
    drainOnce();

    await run({ input: { limit: 5 }, config, token: "Bearer test" });

    expect(analysisGet).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    );
  });

  it("claims the run row as running before classifying, then completes the same row", async () => {
    drainOnce();

    await run({ input: {}, config, token: "Bearer test" });

    expect(articleAnalysisRunCreate).toHaveBeenCalledTimes(2);

    const claim = articleAnalysisRunCreate.mock.calls[0]![0];
    const completion = articleAnalysisRunCreate.mock.calls[1]![0];

    expect(claim.status).toBe("running");
    expect(claim.completedAt).toBeUndefined();
    expect(completion.status).toBe("success");
    expect(completion.completedAt).toEqual(expect.any(String));
    expect(completion.id).toBe(claim.id);
  });

  it("claims the run row before the first analysis fetch", async () => {
    drainOnce();
    const callOrder: string[] = [];
    articleAnalysisRunCreate.mockImplementation(() => {
      callOrder.push("run-record");

      return Promise.resolve({ message: "Success" });
    });
    analysisGet.mockImplementation(() => {
      callOrder.push("analysis-get");

      return Promise.resolve({ dataSources: [], dataSourceTotalCount: 0 });
    });

    await run({ input: {}, config, token: "Bearer test" });

    expect(callOrder[0]).toBe("run-record");
  });

  it("asks the data API to fail runs left running past the stall threshold", async () => {
    drainOnce();

    await run({ input: {}, config, token: "Bearer test" });

    const claim = articleAnalysisRunCreate.mock.calls[0]![0];

    expect(claim.stalledBefore).toEqual(expect.any(String));
    expect(Date.parse(claim.startedAt) - Date.parse(claim.stalledBefore)).toBe(
      60 * 60 * 1000,
    );
  });

  it("does not repeat the stall sweep on the completion write", async () => {
    drainOnce();

    await run({ input: {}, config, token: "Bearer test" });

    const completion = articleAnalysisRunCreate.mock.calls[1]![0];

    expect(completion.stalledBefore).toBeUndefined();
  });

  it("continues the run when claiming the run row fails", async () => {
    drainOnce();
    articleAnalysisRunCreate.mockRejectedValueOnce(new Error("claim boom"));

    const result = await run({ input: {}, config, token: "Bearer test" });

    expect(result.success).toBe(true);
    expect(analysisCreate).toHaveBeenCalledOnce();
  });
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
    expect(posted.articleAnalysisRunId).toEqual(expect.any(String));

    const runRecord = articleAnalysisRunCreate.mock.calls[0]![0];

    expect(runRecord.id).toBe(posted.articleAnalysisRunId);
    expect(runRecord.agentVersion).toBe("4.0.0");
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
