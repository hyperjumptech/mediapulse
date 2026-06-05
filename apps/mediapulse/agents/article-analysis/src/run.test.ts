/** @vitest-environment node */
import type { AgentRunContext } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
  ARTICLE_ANALYSIS_YIELD_SNAPSHOT_MESSAGE,
} from "./article-analysis-observability.js";
import * as RelevancePostChunks from "./analysis-relevance-post-chunks.js";
import * as Llm from "./llm-extract-entities.js";
import * as RelevanceScoring from "./analysis-relevance-scoring.js";
import * as RelevanceSelection from "./analysis-relevance-selection.js";
import { type ArticleAnalysisConfig } from "./config-schema.js";
import type { ArticleAnalysisInput } from "./schemas/article-analysis-input-schema.js";
import { run } from "./run.js";

const analysisGet = vi.fn();
const analysisCreate = vi.fn();
const analysisDataSourceDeleteCreate = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    analysis: {
      get: analysisGet,
      create: analysisCreate,
    },
    analysisDataSourceDelete: {
      create: analysisDataSourceDeleteCreate,
    },
  })),
}));

vi.mock("@mediapulse/env/agents-article-analysis", () => ({
  env: {
    AGENT_DATA_API_URL: "http://localhost:8081",
  },
}));

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => mockLog),
  },
}));

/** Test-only LLM payload; omits keys the real model must supply as null for strict JSON Schema. */
type LlmExtractionOutputMockInput = Omit<
  Llm.LlmExtractionOutput,
  "entities" | "articleMentions"
> & {
  entities: Array<
    Omit<Llm.LlmExtractionOutput["entities"][number], "description"> & {
      description?: string | null;
    }
  >;
  articleMentions: Array<
    Omit<Llm.LlmExtractionOutput["articleMentions"][number], "sentiment"> & {
      sentiment?:
        | Llm.LlmExtractionOutput["articleMentions"][number]["sentiment"]
        | null;
    }
  >;
};

/** Wraps LLM output for mocks; fills omitted `description` / `sentiment` with null. */
const llmResult = (
  object: LlmExtractionOutputMockInput,
  usage: Llm.LlmExtractionUsage | null = null,
): Llm.LlmExtractionCallResult => ({
  object: {
    ...object,
    entities: object.entities.map((e) => ({
      ...e,
      description: e.description ?? null,
    })),
    articleMentions: object.articleMentions.map((m) => ({
      ...m,
      sentiment: m.sentiment ?? null,
    })),
  } satisfies Llm.LlmExtractionOutput,
  usage,
});

const TYPE_ID = "11111111-1111-4111-a111-111111111111";
const REL_ID = "22222222-2222-4222-a222-222222222222";
const DS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DS_ID_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DS_ID_3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DS_ID_4 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const VALID_SOURCE_URL = "https://example.com/news/article";
const VALID_SOURCE_TITLE = "Company expands regional operations headline";

/** Builds article-like body text with at least 120 unique words. */
const validSourceContent = (): string =>
  [
    "Bank Central Asia announced strategic expansion plans across regional markets.",
    ...Array.from(
      { length: 130 },
      (_, index) =>
        `Analyst note ${index} discusses lending trends and deposit growth in Indonesia.`,
    ),
  ].join(" ");

/** Builds paywall stub text with low alphabetic density. */
const paywallSourceContent = (): string =>
  "!!! $$$ ### subscribe to read !!! $$$ ### ".repeat(25);

/** Builds soft-404 stub text under the length threshold. */
const soft404SourceContent = (): string =>
  `Sorry, page not found. ${"x".repeat(200)}`;

/** Builds body text below the minimum word count. */
const shortSourceContent = (): string => "word ".repeat(50);

/** Builds a long article body for structure-aware truncation tests. */
const longTruncationFixtureContent = (): string =>
  [
    "Structure headline",
    "",
    "Lead paragraph one without ticker mention in this opening block.",
    "",
    "Lead paragraph two without ticker mention in this opening block.",
    "",
    "Filler paragraph three has generic market commentary only here.",
    "",
    "Filler paragraph four has generic market commentary only here.",
    "",
    "Apple reported earnings and AAPL shares rose on guidance today.",
    "",
    "Sign up for our newsletter",
    "",
    ...Array.from(
      { length: 130 },
      (_, index) =>
        `Trailing filler paragraph ${index} adds length beyond the truncation budget.`,
    ),
  ].join("\n");

/** Required on `analysis.get` responses (see `getAnalysisResponseSchema`). */
const relevanceSelectionState = {
  utcDayStartIso: "2026-04-09T00:00:00.000Z",
  selectedCountToday: 0,
} as const;

/** Fills `dataSourceTotalCount` when omitted (matches agent-data-api without `limit`). */
const analysisGetOk = <
  T extends {
    ticker?: { id: string; symbol: string; name: string };
    dataSources: readonly unknown[];
    entityTypes: unknown[];
    relationTypes: unknown[];
    existingEntities: unknown[];
    relevanceSelectionState: typeof relevanceSelectionState;
  },
>(
  partial: T & {
    dataSourceTotalCount?: number;
    lastRelevanceScoredAtIso?: string | null;
  },
): T & {
  ticker: { id: string; symbol: string; name: string };
  dataSourceTotalCount: number;
  lastRelevanceScoredAtIso: string | null;
} => ({
  ...partial,
  ticker:
    partial.ticker ??
    ({
      id: "ticker-1",
      symbol: "T1",
      name: "Ticker One",
    } as const),
  dataSourceTotalCount:
    partial.dataSourceTotalCount ?? partial.dataSources.length,
  lastRelevanceScoredAtIso:
    partial.lastRelevanceScoredAtIso !== undefined
      ? partial.lastRelevanceScoredAtIso
      : null,
});

const baseConfig: ArticleAnalysisConfig = {
  openaiApiKey: "sk-test",
};

function runContext(overrides: {
  input: ArticleAnalysisInput;
  config?: Partial<ArticleAnalysisConfig>;
  token?: string;
}): AgentRunContext<ArticleAnalysisInput, ArticleAnalysisConfig> {
  return {
    input: overrides.input,
    config: { ...baseConfig, ...overrides.config },
    token: overrides.token ?? "Bearer test",
  };
}

describe("run", () => {
  beforeEach(() => {
    analysisGet.mockReset();
    analysisCreate.mockReset();
    analysisDataSourceDeleteCreate.mockReset();
    mockLog.info.mockReset();
    mockLog.warn.mockReset();
    mockLog.error.mockReset();
    vi.mocked(logger.child).mockClear();
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const source = {
    id: DS_ID,
    url: VALID_SOURCE_URL,
    title: VALID_SOURCE_TITLE,
    content: validSourceContent(),
    tickerId: "ticker-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("returns success when no data sources after GET", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [],
        entityTypes: [],
        relationTypes: [],
        existingEntities: [],
        relevanceSelectionState,
      }),
    );

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(true);
    expect(result.message).toContain("0 source(s)");
    expect(analysisCreate).not.toHaveBeenCalled();
  });

  it("caps analysis GET limit by analysisGetDataSourceLimitMax from Hermes config", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [],
        entityTypes: [],
        relationTypes: [],
        existingEntities: [],
        relevanceSelectionState,
      }),
    );

    await run(
      runContext({
        input: {
          tickerId: "ticker-cap",
        },
        config: { maxBatchSize: 10, analysisGetDataSourceLimitMax: 4 },
      }),
    );

    expect(analysisGet).toHaveBeenCalledWith({
      tickerId: "ticker-cap",
      unanalyzed: true,
      limit: 4,
    });
  });

  it("uses cfg.maxBatchSize as analysis GET limit when under API cap", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [],
        entityTypes: [],
        relationTypes: [],
        existingEntities: [],
        relevanceSelectionState,
      }),
    );

    await run(
      runContext({
        input: { tickerId: "ticker-limit" },
        config: { maxBatchSize: 3 },
      }),
    );

    expect(analysisGet).toHaveBeenCalledWith({
      tickerId: "ticker-limit",
      unanalyzed: true,
      limit: 3,
    });
  });

  it("fails when vocabulary is empty", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [source],
        entityTypes: [],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("vocabulary");
  });

  it("skips vocabulary-invalid slices and continues processing others", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          source,
          {
            ...source,
            id: DS_ID_2,
            title: "Article headline two test",
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource")
      .mockResolvedValueOnce(
        llmResult({
          entities: [
            {
              canonicalName: "Bad",
              typeId: "99999999-9999-4999-a999-999999999999",
              aliases: [],
            },
          ],
          relations: [],
          articleMentions: [],
        }),
      )
      .mockResolvedValueOnce(
        llmResult({
          entities: [
            {
              canonicalName: "Good",
              typeId: TYPE_ID,
              aliases: [],
            },
            {
              canonicalName: "Other",
              typeId: TYPE_ID,
              aliases: [],
            },
          ],
          relations: [
            {
              fromEntityName: "Good",
              toEntityName: "Other",
              relationTypeId: REL_ID,
            },
          ],
          articleMentions: [],
        }),
      );

    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 1,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 1,
      });

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(true);
    expect(result.details).toMatchObject({
      vocabularyFailures: 1,
      entitiesCreated: 1,
      articleEntityRowsPosted: 0,
      mentionPostChunks: 0,
      articlesScored: 1,
      articlesSelected: 1,
      relevancePostChunks: 1,
    });
    expect(
      (result.details as { extractionFailures?: { stage: string }[] })
        .extractionFailures,
    ).toHaveLength(1);
    expect(
      (result.details as { extractionFailures?: { stage: string }[] })
        .extractionFailures?.[0]?.stage,
    ).toBe("vocabulary");
    expect(analysisCreate).toHaveBeenCalledTimes(2);
  });

  it("posts chunks and aggregates POST response counts", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [source],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "A", typeId: TYPE_ID, aliases: [] },
          { canonicalName: "B", typeId: TYPE_ID, aliases: [] },
          { canonicalName: "C", typeId: TYPE_ID, aliases: [] },
        ],
        relations: [
          { fromEntityName: "A", toEntityName: "B", relationTypeId: REL_ID },
          { fromEntityName: "B", toEntityName: "C", relationTypeId: REL_ID },
        ],
        articleMentions: [],
      }),
    );

    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 2,
        entitiesReused: 0,
        relationsCreated: 1,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 2,
        relationsCreated: 1,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 1,
      });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { postChunkRelationBatchSize: 1 },
      }),
    );

    expect(result.success).toBe(true);
    expect(analysisCreate).toHaveBeenCalledTimes(3);
    expect(analysisCreate.mock.calls[2]?.[0]?.articleRelevances).toHaveLength(
      1,
    );
    expect(result.details).toMatchObject({
      postChunks: 2,
      entitiesCreated: 2,
      entitiesReused: 2,
      relationsCreated: 2,
      articleEntityRowsPosted: 0,
      mentionPostChunks: 0,
      articlesScored: 1,
      articlesSelected: 1,
      relevancePostChunks: 1,
    });
  });

  it("posts articleEntities after ER chunks when LLM returns articleMentions", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
        relations: [],
        articleMentions: [
          {
            entityName: "A",
            mentionCount: 2,
            confidence: 0.91,
            sentiment: "POSITIVE",
          },
        ],
      }),
    );

    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 1,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 1,
      });

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(true);
    expect(analysisCreate).toHaveBeenCalledTimes(3);
    expect(analysisCreate.mock.calls[0]?.[0]?.articleEntities).toEqual([]);
    expect(analysisCreate.mock.calls[1]?.[0]?.articleEntities).toHaveLength(1);
    expect(
      analysisCreate.mock.calls[1]?.[0]?.articleEntities?.[0],
    ).toMatchObject({
      dataSourceId: DS_ID,
      entityName: "A",
      mentionCount: 2,
      confidence: 0.91,
      sentiment: "POSITIVE",
    });
    expect(result.details).toMatchObject({
      postChunks: 1,
      mentionPostChunks: 1,
      articleEntityRowsPosted: 1,
      articlesScored: 1,
      articlesSelected: 1,
      relevancePostChunks: 1,
    });
  });

  it("surfaces article entity parse errors in run details", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
        relations: [],
        articleMentions: [
          {
            entityName: "A",
            mentionCount: 2,
            confidence: 1.5,
            sentiment: "POSITIVE",
          },
        ],
      }),
    );

    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 1,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 0,
      });

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(true);
    expect(analysisCreate).toHaveBeenCalledTimes(2);
    expect(result.details).toMatchObject({
      mentionPostChunks: 0,
      articleEntityRowsPosted: 0,
    });
    expect(
      Array.isArray(
        (result.details as { articleEntityParseErrors?: unknown[] })
          .articleEntityParseErrors,
      ),
    ).toBe(true);
    expect(
      (result.details as { articleEntityParseErrors?: unknown[] })
        .articleEntityParseErrors?.length,
    ).toBeGreaterThan(0);
  });

  it("fails run when relevance rows fail validation before selection", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
        relations: [],
        articleMentions: [],
      }),
    );

    analysisCreate.mockResolvedValueOnce({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 0,
      articlesSelected: 0,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { scoreBreakdownVersion: 1.5 },
      }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("validation failed before selection");

    const validationSummary = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { semanticFailureReason?: string }).semanticFailureReason ===
          "relevance_row_validation",
    );
    expect(validationSummary).toBeDefined();
    expect((validationSummary?.[0] as { outcome: string }).outcome).toBe(
      "failure",
    );
    expect((validationSummary?.[0] as { event?: string }).event).toBe(
      ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(
      (validationSummary?.[0] as { relevanceRowValidationFailures: number })
        .relevanceRowValidationFailures,
    ).toBeGreaterThan(0);
  });

  it("fails run when relevance chunk parse errors are reported", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
        relations: [],
        articleMentions: [],
      }),
    );

    analysisCreate.mockResolvedValueOnce({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 0,
      articlesSelected: 0,
    });

    vi.spyOn(
      RelevancePostChunks,
      "buildArticleRelevancePostChunks",
    ).mockReturnValue({
      chunks: [],
      parseErrors: ["bad row"],
    });

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("relevance chunk parse failed");

    const parseSummary = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { semanticFailureReason?: string }).semanticFailureReason ===
          "relevance_chunk_parse",
    );
    expect(parseSummary).toBeDefined();
    expect((parseSummary?.[0] as { outcome: string }).outcome).toBe("failure");
    expect((parseSummary?.[0] as { event?: string }).event).toBe(
      ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(
      (parseSummary?.[0] as { chunkParseErrorsArticleRelevance: number })
        .chunkParseErrorsArticleRelevance,
    ).toBeGreaterThan(0);
  });

  it("returns failure when analysis GET throws", async () => {
    analysisGet.mockRejectedValue(new Error("upstream error"));

    const result = await run(runContext({ input: { tickerId: "ticker-3" } }));

    expect(result).toEqual({
      success: false,
      message: "upstream error",
      details: {
        yieldSnapshot: expect.objectContaining({
          batchSize: 0,
          ratios: expect.objectContaining({
            extractionYield: 0,
          }),
        }),
      },
    });
    expect(mockLog.error).toHaveBeenCalled();
  });

  it("resolves extracted names to existing canonical entities before POST", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [source],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            canonicalName: "Alpha Incorporated",
            typeId: TYPE_ID,
            aliases: ["Alpha"],
          },
        ],
        relevanceSelectionState,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "Alpha", typeId: TYPE_ID, aliases: [] },
          { canonicalName: "Beta", typeId: TYPE_ID, aliases: [] },
        ],
        relations: [
          {
            fromEntityName: "Alpha",
            toEntityName: "Beta",
            relationTypeId: REL_ID,
          },
        ],
        articleMentions: [],
      }),
    );

    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 1,
        entitiesReused: 1,
        relationsCreated: 1,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 1,
      });

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(true);
    const postBody = analysisCreate.mock.calls[0]?.[0];
    expect(
      postBody?.entities.map(
        (entity: { canonicalName: string }) => entity.canonicalName,
      ),
    ).toContain("Alpha Incorporated");
    expect(
      postBody?.relations.map(
        (relation: { fromEntityName: string }) => relation.fromEntityName,
      ),
    ).toContain("Alpha Incorporated");
  });

  it("continues after vocabulary failure on one source when another succeeds (partial_success)", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: "u1",
            title: "Article headline one test",
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
          {
            id: DS_ID_2,
            url: "u2",
            title: "Article headline two test",
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    let extractCall = 0;
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockImplementation(
      async () => {
        extractCall += 1;
        if (extractCall === 1) {
          return llmResult({
            entities: [
              {
                canonicalName: "Bad",
                typeId: "99999999-9999-4999-a999-999999999999",
                aliases: [],
              },
            ],
            relations: [],
            articleMentions: [],
          });
        }
        return llmResult({
          entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
          relations: [],
          articleMentions: [],
        });
      },
    );

    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 1,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 0,
      });

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(true);
    expect(result.details?.runStatus).toBe("partial_success");
    expect(result.details?.extractionFailures).toHaveLength(1);
    expect(
      (result.details?.extractionFailures as { stage: string }[])[0]?.stage,
    ).toBe("vocabulary");
    expect(analysisCreate).toHaveBeenCalledTimes(2);

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(summaryCall).toBeDefined();
    expect(
      (summaryCall?.[0] as { extractionFailuresVocabulary: number })
        .extractionFailuresVocabulary,
    ).toBe(1);
    expect(
      (summaryCall?.[0] as { extractionFailuresLlm: number })
        .extractionFailuresLlm,
    ).toBe(0);
  });

  it("stops POST phases after ER chunk failure and records postFailures", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "A", typeId: TYPE_ID, aliases: [] },
          { canonicalName: "B", typeId: TYPE_ID, aliases: [] },
          { canonicalName: "C", typeId: TYPE_ID, aliases: [] },
        ],
        relations: [
          { fromEntityName: "A", toEntityName: "B", relationTypeId: REL_ID },
          { fromEntityName: "B", toEntityName: "C", relationTypeId: REL_ID },
        ],
        articleMentions: [],
      }),
    );

    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 1,
        entitiesReused: 0,
        relationsCreated: 1,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockRejectedValueOnce(new Error("Agent data API error: 500"));

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { postChunkRelationBatchSize: 1 },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.details?.runStatus).toBe("partial_success");
    expect(result.details?.postFailures).toHaveLength(1);
    expect(
      (result.details?.postFailures as { chunkKind: string }[])[0]?.chunkKind,
    ).toBe("entities_relations");
    expect(analysisCreate).toHaveBeenCalledTimes(2);
    expect(result.details?.postChunks).toBe(1);
    expect(result.details?.relevancePostChunks).toBe(0);
    expect(result.details?.mentionPostChunks).toBe(0);
  });

  it("continues to relevance scoring when article_entities POST fails", async () => {
    // Setup
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
        relations: [],
        articleMentions: [
          {
            entityName: "A",
            mentionCount: 1,
            confidence: 0.8,
            sentiment: "NEUTRAL",
          },
        ],
      }),
    );

    // ER chunk succeeds; article_entities chunk fails; relevance chunk succeeds.
    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 1,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockRejectedValueOnce(
        new Error(
          'Agent data API error: 400 - {"error":"Unknown entityName for article entity: A"}',
        ),
      )
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 1,
      });

    // Act
    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    // Assert: run still succeeds and relevance was scored despite article_entities failure.
    expect(result.success).toBe(true);
    expect(result.details?.articlesScored).toBe(1);
    expect(result.details?.articlesSelected).toBe(1);
    expect(result.details?.relevancePostChunks).toBe(1);
    expect(result.details?.postFailures).toHaveLength(1);
    expect(
      (result.details?.postFailures as { chunkKind: string }[])[0]?.chunkKind,
    ).toBe("article_entities");
    // 3 calls: ER chunk + article_entities chunk (failed) + relevance chunk.
    expect(analysisCreate).toHaveBeenCalledTimes(3);
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ chunkKind: "article_entities", chunkIndex: 0 }),
      expect.stringContaining("continuing to next chunk"),
    );
  });

  it("continues to remaining article_entities chunks after one chunk fails", async () => {
    // Setup: one article with two distinct entities → two article_entities chunks (batchSize=1).
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    // LLM extracts two entities A and B, each with a mention.
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "A", typeId: TYPE_ID, aliases: [] },
          { canonicalName: "B", typeId: TYPE_ID, aliases: [] },
        ],
        relations: [],
        articleMentions: [
          {
            entityName: "A",
            mentionCount: 1,
            confidence: 0.8,
            sentiment: "NEUTRAL",
          },
          {
            entityName: "B",
            mentionCount: 1,
            confidence: 0.7,
            sentiment: "NEUTRAL",
          },
        ],
      }),
    );

    // ER chunk succeeds; article_entities chunk 0 (entity A) fails; chunk 1 (entity B) succeeds; relevance succeeds.
    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 2,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockRejectedValueOnce(new Error("Agent data API error: 400"))
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 1,
      });

    // Act
    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { postChunkArticleEntityBatchSize: 1 },
      }),
    );

    // Assert: second chunk was attempted, relevance proceeds, only 1 postFailure.
    expect(result.success).toBe(true);
    expect(result.details?.mentionPostChunks).toBe(1);
    expect(result.details?.postFailures).toHaveLength(1);
    expect(result.details?.relevancePostChunks).toBe(1);
    // 4 calls: ER chunk + failed article_entities chunk 0 + article_entities chunk 1 + relevance chunk.
    expect(analysisCreate).toHaveBeenCalledTimes(4);
  });

  it("fails run when extraction successes are below runPolicy minimum", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
          {
            id: DS_ID_2,
            url: "u2",
            title: "Article headline two test",
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          {
            canonicalName: "Bad",
            typeId: "99999999-9999-4999-a999-999999999999",
            aliases: [],
          },
        ],
        relations: [],
        articleMentions: [],
      }),
    );

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("run policy");
    expect(analysisCreate).not.toHaveBeenCalled();
  });

  it("skips non-article sources in prefilter stage before LLM", async () => {
    // Setup
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: "https://finance.yahoo.com/quote/BBCA.JK/",
            title: "BBCA Quote Page Title",
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    const extractSpy = vi.spyOn(Llm, "extractEntitiesAndRelationsForSource");

    // Act
    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    // Assert
    expect(result.success).toBe(false);
    expect(extractSpy).not.toHaveBeenCalled();
    expect(analysisDataSourceDeleteCreate).toHaveBeenCalledWith({
      tickerId: "ticker-1",
      dataSourceId: DS_ID,
    });
    expect(
      (result.details?.extractionFailures as { stage: string }[])[0]?.stage,
    ).toBe("prefilter");
  });

  it("tracks droppedByContentQuality counters and only extracts clean sources", async () => {
    // Setup
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
          {
            id: DS_ID_2,
            url: "https://example.com/paywall",
            title: "Premium article headline here",
            content: paywallSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
          {
            id: DS_ID_3,
            url: "https://example.com/missing",
            title: "Missing article headline here",
            content: soft404SourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
          {
            id: DS_ID_4,
            url: "https://example.com/stub",
            title: "Wire stub headline here",
            content: shortSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    const extractSpy = vi
      .spyOn(Llm, "extractEntitiesAndRelationsForSource")
      .mockResolvedValue(
        llmResult({
          entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
          relations: [],
          articleMentions: [],
        }),
      );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 0,
    });

    // Act
    await run(runContext({ input: { tickerId: "ticker-1" } }));

    // Assert
    expect(extractSpy).toHaveBeenCalledTimes(1);

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(summaryCall).toBeDefined();
    expect(
      (summaryCall?.[0] as { droppedByContentQuality: Record<string, number> })
        .droppedByContentQuality,
    ).toEqual({
      prefilter_blocked_host: 0,
      prefilter_blocked_path: 0,
      prefilter_index_title: 0,
      content_no_title: 0,
      content_soft_404: 1,
      content_access_gated: 1,
      content_too_short: 1,
      content_repetitive: 0,
    });
    expect(
      (summaryCall?.[0] as { extractionCalls: number }).extractionCalls,
    ).toBe(1);
  });

  it("uses structure-aware truncation when enabled and naive slice when disabled", async () => {
    const COMPANY_TYPE_ID = "33333333-3333-4333-a333-333333333333";
    const longContent = longTruncationFixtureContent();
    const baseGetResponse = analysisGetOk({
      dataSources: [
        {
          id: DS_ID,
          url: VALID_SOURCE_URL,
          title: VALID_SOURCE_TITLE,
          content: longContent,
          tickerId: "ticker-1",
          createdAt: new Date(),
        },
      ],
      entityTypes: [
        { id: TYPE_ID, name: "Co", description: null },
        { id: COMPANY_TYPE_ID, name: "Company", description: null },
      ],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [
        {
          id: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
          canonicalName: "AAPL",
          typeId: COMPANY_TYPE_ID,
          aliases: ["Apple Inc"],
        },
      ],
      relevanceSelectionState,
      lastRelevanceScoredAtIso: null,
    });

    analysisGet.mockResolvedValue(baseGetResponse);
    const extractSpy = vi
      .spyOn(Llm, "extractEntitiesAndRelationsForSource")
      .mockResolvedValue(
        llmResult({
          entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
          relations: [],
          articleMentions: [],
        }),
      );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 0,
    });

    await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {
          useStructureAwareTruncation: true,
          maxContentChars: 260,
        },
      }),
    );

    const structuredUserMessage = extractSpy.mock.calls[0]?.[0]?.messages?.[1]
      ?.content as string;
    expect(structuredUserMessage).toContain("AAPL shares rose");
    expect(structuredUserMessage).not.toContain("Sign up for our newsletter");

    extractSpy.mockClear();
    analysisGet.mockResolvedValue(baseGetResponse);

    await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {
          useStructureAwareTruncation: false,
          maxContentChars: 260,
        },
      }),
    );

    const slicedUserMessage = extractSpy.mock.calls[0]?.[0]?.messages?.[1]
      ?.content as string;
    expect(slicedUserMessage).toContain(longContent.slice(0, 260).slice(0, 40));
    expect(slicedUserMessage).not.toContain("AAPL shares rose");
  });

  it("logs safe error shape when LLM extraction throws", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockRejectedValue(
      new Error("provider timeout"),
    );

    await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(mockLog.warn).toHaveBeenCalledWith(
      {
        dataSourceId: DS_ID,
        stage: "llm",
        llmFailureReason: "other",
        err: { type: "Error", message: "provider timeout" },
      },
      "article-analysis LLM extraction failed for source; skipping",
    );
  });

  it("does not log raw article content, bearer token, or API key in default log payloads", async () => {
    const secretBody = "DO_NOT_LOG_THIS_ARTICLE_BODY_SECRET";
    const bearer = "Bearer DO_NOT_LOG_THIS_AGENT_TOKEN";
    const apiKey = "sk-DO_NOT_LOG_THIS_OPENAI_KEY";
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: `${secretBody} ${validSourceContent()}`,
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
        relations: [],
        articleMentions: [],
      }),
    );

    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 1,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 1,
      });

    await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { openaiApiKey: apiKey },
        token: bearer,
      }),
    );

    const allPayloads = [
      ...mockLog.info.mock.calls,
      ...mockLog.warn.mock.calls,
      ...mockLog.error.mock.calls,
    ].map((c) => JSON.stringify(c[0]));
    for (const p of allPayloads) {
      expect(p).not.toContain(secretBody);
      expect(p).not.toContain(bearer);
      expect(p).not.toContain(apiKey);
    }
  });

  it("logs verbose start", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [],
        entityTypes: [],
        relationTypes: [],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    await run(
      runContext({
        input: { tickerId: "tv" },
        config: { verbose: true },
      }),
    );

    expect(mockLog.info).toHaveBeenCalled();
  });

  it("applies maxBatchSize from config on incremental runs", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: "u1",
            title: "Article headline one test",
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
          {
            id: DS_ID_2,
            url: "u2",
            title: "Article headline two test",
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    const extractSpy = vi
      .spyOn(Llm, "extractEntitiesAndRelationsForSource")
      .mockResolvedValue(
        llmResult({
          entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
          relations: [],
          articleMentions: [],
        }),
      );

    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 1,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 0,
      });

    await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { maxBatchSize: 1 },
      }),
    );

    expect(extractSpy).toHaveBeenCalledTimes(1);
  });

  it("skips run when unanalyzed backlog is below debounceMinUnanalyzedCount", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
          {
            id: DS_ID_2,
            url: "u2",
            title: "Article headline two test",
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { debounceMinUnanalyzedCount: 5 },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("debounce");
    expect(analysisCreate).not.toHaveBeenCalled();

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { semanticFailureReason?: string }).semanticFailureReason ===
          "debounce_min_unanalyzed_count",
    );
    expect(summaryCall).toBeDefined();
  });

  it("skips run when last relevance scored within debounceMinMinutesSinceLastScore", async () => {
    const lastScored = new Date(Date.now() - 30 * 60_000).toISOString();
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: lastScored,
      }),
    );

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { debounceMinMinutesSinceLastScore: 60 },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("debounce");
    expect(analysisCreate).not.toHaveBeenCalled();

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { semanticFailureReason?: string }).semanticFailureReason ===
          "debounce_min_minutes_since_last_score",
    );
    expect(summaryCall).toBeDefined();
  });

  it("falls back to single-pass extraction when brainstorm fails", async () => {
    // Setup
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "fetchArticleBrainstorm").mockRejectedValue(
      new Error("timeout"),
    );
    const extractSpy = vi
      .spyOn(Llm, "extractEntitiesAndRelationsForSource")
      .mockResolvedValue(
        llmResult({
          entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
          relations: [],
          articleMentions: [],
        }),
      );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    // Act
    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { useBrainstormPass: true },
      }),
    );

    // Assert
    expect(result.success).toBe(true);
    expect(extractSpy).toHaveBeenCalledTimes(1);
    expect(extractSpy.mock.calls[0]?.[0]?.brainstormText).toBeUndefined();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSourceId: DS_ID,
        stage: "brainstorm",
      }),
      "article-analysis brainstorm pass failed; falling back to single-pass extraction",
    );

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(summaryCall).toBeDefined();
    expect(
      (summaryCall?.[0] as { brainstormCalls?: number }).brainstormCalls,
    ).toBe(0);
    expect(
      (summaryCall?.[0] as { extractionCalls?: number }).extractionCalls,
    ).toBe(1);
    expect(
      (summaryCall?.[0] as { extractionSuccessCount?: number })
        .extractionSuccessCount,
    ).toBe(1);
  });

  it("passes brainstorm notes into structured extraction when enabled", async () => {
    // Setup
    const brainstormText =
      "KEY PLAYERS:\n- Apple\n- Tim Cook\nEVENTS:\n- Q2 earnings beat";
    const entityCounts: number[] = [];
    const buildWire = (count: number) => ({
      entities: Array.from({ length: count }, (_, index) => ({
        canonicalName: `Entity${String(index)}`,
        typeId: TYPE_ID,
        description: "",
        aliases: [] as string[],
      })),
      relations: [],
      articleMentions: [],
    });
    const extractSpy = vi
      .spyOn(Llm, "extractEntitiesAndRelationsForSource")
      .mockImplementation(async (params) => {
        const count = params.brainstormText ? 2 : 1;
        entityCounts.push(count);
        const wire = buildWire(count);
        expect(Llm.llmExtractionOpenAiWireSchema.safeParse(wire).success).toBe(
          true,
        );
        return llmResult({
          entities: wire.entities.map((entity) => ({
            canonicalName: entity.canonicalName,
            typeId: entity.typeId,
            description: entity.description,
            aliases: entity.aliases,
          })),
          relations: wire.relations,
          articleMentions: wire.articleMentions,
        });
      });

    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 2,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });
    vi.spyOn(Llm, "fetchArticleBrainstorm").mockResolvedValue({
      text: brainstormText,
      usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
    });

    // Act — with brainstorm
    const withBrainstorm = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { useBrainstormPass: true },
      }),
    );

    // Assert
    expect(withBrainstorm.success).toBe(true);
    expect(extractSpy.mock.calls[0]?.[0]?.brainstormText).toBe(brainstormText);

    // Act — without brainstorm on the same fixture
    const withoutBrainstorm = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { useBrainstormPass: false },
      }),
    );

    expect(withoutBrainstorm.success).toBe(true);
    expect(extractSpy.mock.calls[1]?.[0]?.brainstormText).toBeUndefined();
    expect(entityCounts).toEqual([2, 1]);
    expect(entityCounts[0]).toBeGreaterThanOrEqual(entityCounts[1] ?? 0);
  });

  it("drops ungrounded entities and relations under the drop grounding policy", async () => {
    const appleArticleContent = (): string =>
      `${validSourceContent()} Apple expanded manufacturing capacity this year.`;
    const hallucinatedExtraction = llmResult({
      entities: [
        { canonicalName: "FakeCo", typeId: TYPE_ID, aliases: [] },
        { canonicalName: "Apple", typeId: TYPE_ID, aliases: [] },
      ],
      relations: [
        {
          fromEntityName: "FakeCo",
          toEntityName: "Apple",
          relationTypeId: REL_ID,
        },
      ],
      articleMentions: [
        {
          entityName: "FakeCo",
          mentionCount: 2,
          confidence: 0.95,
          sentiment: null,
        },
      ],
    });

    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: appleArticleContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      hallucinatedExtraction,
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { entityGroundingPolicy: "drop" },
      }),
    );

    expect(result.success).toBe(true);
    const postedEntities = analysisCreate.mock.calls[0]?.[0]?.entities as
      | Array<{ canonicalName: string }>
      | undefined;
    expect(postedEntities?.map((entity) => entity.canonicalName)).toEqual([
      "Apple",
    ]);
    expect(analysisCreate.mock.calls[0]?.[0]?.relations).toEqual([]);

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(
      (summaryCall?.[0] as { grounding?: { entitiesUngroundedTotal: number } })
        .grounding?.entitiesUngroundedTotal,
    ).toBe(1);
  });

  it("flags ungrounded entities but drops their relations under the flag policy", async () => {
    const appleArticleContent = (): string =>
      `${validSourceContent()} Apple expanded manufacturing capacity this year.`;
    const hallucinatedExtraction = llmResult({
      entities: [
        { canonicalName: "FakeCo", typeId: TYPE_ID, aliases: [] },
        { canonicalName: "Apple", typeId: TYPE_ID, aliases: [] },
      ],
      relations: [
        {
          fromEntityName: "FakeCo",
          toEntityName: "Apple",
          relationTypeId: REL_ID,
        },
      ],
      articleMentions: [
        {
          entityName: "FakeCo",
          mentionCount: 2,
          confidence: 0.95,
          sentiment: null,
        },
      ],
    });

    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: appleArticleContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      hallucinatedExtraction,
    );
    analysisCreate
      .mockResolvedValueOnce({
        entitiesCreated: 2,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      })
      .mockResolvedValueOnce({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 1,
      });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { entityGroundingPolicy: "flag" },
      }),
    );

    expect(result.success).toBe(true);
    const postedEntities = analysisCreate.mock.calls[0]?.[0]?.entities as
      | Array<{ canonicalName: string }>
      | undefined;
    expect(
      postedEntities?.map((entity) => entity.canonicalName).sort(),
    ).toEqual(["Apple", "FakeCo"]);
    expect(analysisCreate.mock.calls[0]?.[0]?.relations).toEqual([]);
    expect(
      analysisCreate.mock.calls[1]?.[0]?.articleEntities?.[0]?.confidence,
    ).toBe(0.4);
  });

  it("skips relation critique when a source has fewer relations than relationCritiqueMinRelationCount", async () => {
    const critiqueSpy = vi
      .spyOn(Llm, "critiqueExtractedRelations")
      .mockResolvedValue({ ratings: [], usage: null });

    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "A", typeId: TYPE_ID, aliases: [] },
          { canonicalName: "B", typeId: TYPE_ID, aliases: [] },
        ],
        relations: [
          {
            fromEntityName: "A",
            toEntityName: "B",
            relationTypeId: REL_ID,
          },
          {
            fromEntityName: "B",
            toEntityName: "A",
            relationTypeId: REL_ID,
          },
        ],
        articleMentions: [],
      }),
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 2,
      entitiesReused: 0,
      relationsCreated: 2,
      articlesScored: 1,
      articlesSelected: 1,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {
          useRelationSelfCritique: true,
          relationCritiqueMinRelationCount: 3,
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(critiqueSpy).not.toHaveBeenCalled();
    expect(analysisCreate.mock.calls[0]?.[0]?.relations).toHaveLength(2);

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(
      (summaryCall?.[0] as { relationCritique?: { sourcesCritiqued: number } })
        .relationCritique,
    ).toBeUndefined();
  });

  it("skips relation critique when the run deadline has elapsed", async () => {
    const critiqueSpy = vi
      .spyOn(Llm, "critiqueExtractedRelations")
      .mockResolvedValue({ ratings: [], usage: null });

    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "A", typeId: TYPE_ID, aliases: [] },
          { canonicalName: "B", typeId: TYPE_ID, aliases: [] },
          { canonicalName: "C", typeId: TYPE_ID, aliases: [] },
        ],
        relations: [
          {
            fromEntityName: "A",
            toEntityName: "B",
            relationTypeId: REL_ID,
          },
          {
            fromEntityName: "B",
            toEntityName: "C",
            relationTypeId: REL_ID,
          },
          {
            fromEntityName: "C",
            toEntityName: "A",
            relationTypeId: REL_ID,
          },
        ],
        articleMentions: [],
      }),
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 3,
      entitiesReused: 0,
      relationsCreated: 3,
      articlesScored: 1,
      articlesSelected: 1,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {
          useRelationSelfCritique: true,
          runDeadlineMs: 0,
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(critiqueSpy).not.toHaveBeenCalled();
    expect(analysisCreate.mock.calls[0]?.[0]?.relations).toHaveLength(3);

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(
      (summaryCall?.[0] as { relationCritique?: { critiqueCalls: number } })
        .relationCritique?.critiqueCalls,
    ).toBe(0);
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSourceId: DS_ID,
        runDeadlineMs: 0,
      }),
      "article-analysis skipping relation critique due to run deadline",
    );
  });

  it("skips the entire source under strict vocabulary policy when one UUID is invalid", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [source],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "Good", typeId: TYPE_ID, aliases: [] },
          {
            canonicalName: "Bad",
            typeId: "99999999-9999-4999-a999-999999999999",
            aliases: [],
          },
        ],
        relations: [],
        articleMentions: [],
      }),
    );

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { vocabularyPolicy: "strict" },
      }),
    );

    expect(result.success).toBe(false);
    expect(result.details?.vocabularyFailures).toBe(1);
    expect(analysisCreate).not.toHaveBeenCalled();
    expect(
      (result.details?.extractionFailures as { stage: string }[])[0]?.stage,
    ).toBe("vocabulary");
  });

  it("keeps valid rows under partition policy when one entity UUID is invalid", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [source],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "Good", typeId: TYPE_ID, aliases: [] },
          {
            canonicalName: "Bad",
            typeId: "99999999-9999-4999-a999-999999999999",
            aliases: [],
          },
        ],
        relations: [],
        articleMentions: [],
      }),
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { vocabularyPolicy: "partition" },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.details?.vocabularyFailures).toBe(0);
    expect(
      (
        analysisCreate.mock.calls[0]?.[0]?.entities as Array<{
          canonicalName: string;
        }>
      )?.map((entity) => entity.canonicalName),
    ).toEqual(["Good"]);

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(
      (
        summaryCall?.[0] as {
          vocabularyPartitioning?: { badEntitiesDropped: number };
        }
      ).vocabularyPartitioning?.badEntitiesDropped,
    ).toBe(1);
  });

  it("recovers repaired entities under repair vocabulary policy", async () => {
    const repairSpy = vi
      .spyOn(Llm, "repairExtractionVocabulary")
      .mockResolvedValue({
        entities: [
          {
            canonicalName: "Bad",
            typeId: TYPE_ID,
            aliases: [],
          },
        ],
        relations: [],
        usage: null,
      });

    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [source],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "Good", typeId: TYPE_ID, aliases: [] },
          {
            canonicalName: "Bad",
            typeId: "99999999-9999-4999-a999-999999999999",
            aliases: [],
          },
        ],
        relations: [],
        articleMentions: [],
      }),
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 2,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { vocabularyPolicy: "repair" },
      }),
    );

    expect(result.success).toBe(true);
    expect(repairSpy).toHaveBeenCalledOnce();
    const postedNames = (
      analysisCreate.mock.calls[0]?.[0]?.entities as Array<{
        canonicalName: string;
      }>
    )?.map((entity) => entity.canonicalName);
    expect(postedNames?.sort()).toEqual(["Bad", "Good"]);

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(
      (
        summaryCall?.[0] as {
          vocabularyPartitioning?: { rowsRecoveredByRepair: number };
        }
      ).vocabularyPartitioning?.rowsRecoveredByRepair,
    ).toBe(1);
  });

  it("falls back to partitioned good rows when vocabulary repair throws", async () => {
    vi.spyOn(Llm, "repairExtractionVocabulary").mockRejectedValue(
      new Error("repair failed"),
    );

    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [source],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "Good", typeId: TYPE_ID, aliases: [] },
          {
            canonicalName: "Bad",
            typeId: "99999999-9999-4999-a999-999999999999",
            aliases: [],
          },
        ],
        relations: [],
        articleMentions: [],
      }),
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { vocabularyPolicy: "repair" },
      }),
    );

    expect(result.success).toBe(true);
    expect(
      (
        analysisCreate.mock.calls[0]?.[0]?.entities as Array<{
          canonicalName: string;
        }>
      )?.map((entity) => entity.canonicalName),
    ).toEqual(["Good"]);

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(
      (
        summaryCall?.[0] as {
          vocabularyPartitioning?: {
            repairCallsFailed: number;
            rowsRecoveredByRepair: number;
          };
        }
      ).vocabularyPartitioning,
    ).toMatchObject({
      repairCallsFailed: 1,
      rowsRecoveredByRepair: 0,
    });
  });

  it("ranks Reuters above a stale unknown blog when useSourceQualityV2 is enabled", async () => {
    vi.useFakeTimers({ now: new Date("2026-06-01T12:00:00.000Z") });
    const now = new Date("2026-06-01T12:00:00.000Z");
    const twoHoursAgo = new Date(now.getTime() - 2 * 3_600_000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 3_600_000);

    const relevanceSpy = vi.spyOn(RelevanceScoring, "buildDraftRelevanceRow");

    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: "https://www.reuters.com/business/story-123",
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: twoHoursAgo,
            publishedAt: twoHoursAgo,
          },
          {
            id: DS_ID_2,
            url: "https://random-blog.example.com/opinion-piece",
            title: "Article headline two test",
            content: `${validSourceContent()}\n\n${"SHOUTING RUMOR OPINION ".repeat(90)}`,
            tickerId: "ticker-1",
            createdAt: fourteenDaysAgo,
            publishedAt: fourteenDaysAgo,
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
        relations: [],
        articleMentions: [],
      }),
    );

    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { useSourceQualityV2: true },
      }),
    );

    vi.useRealTimers();

    expect(result.success).toBe(true);

    const reutersRow = relevanceSpy.mock.results
      .map((call) => call.value)
      .find(
        (row) =>
          row !== undefined &&
          (row as RelevanceScoring.ArticleRelevanceRow).dataSourceId === DS_ID,
      ) as RelevanceScoring.ArticleRelevanceRow | undefined;
    const blogRow = relevanceSpy.mock.results
      .map((call) => call.value)
      .find(
        (row) =>
          row !== undefined &&
          (row as RelevanceScoring.ArticleRelevanceRow).dataSourceId ===
            DS_ID_2,
      ) as RelevanceScoring.ArticleRelevanceRow | undefined;

    expect(reutersRow).toBeDefined();
    expect(blogRow).toBeDefined();
    expect(reutersRow!.score).toBeGreaterThan(blogRow!.score);
    expect(reutersRow!.scoreBreakdown.sourceQuality).toBeGreaterThan(0.8);
    expect(blogRow!.scoreBreakdown.sourceQuality).toBeLessThan(0.4);

    const summaryCall = mockLog.info.mock.calls.find(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(
      (summaryCall?.[0] as { sourceQuality?: { tier1Sources: number } })
        .sourceQuality?.tier1Sources,
    ).toBe(1);
  });

  it("matches classic applyRelevanceSelection when useSelectionDiversification is false", async () => {
    const diversifiedSpy = vi.spyOn(
      RelevanceSelection,
      "applyRelevanceSelectionDiversified",
    );
    const classicSpy = vi.spyOn(RelevanceSelection, "applyRelevanceSelection");

    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [source],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
        relations: [],
        articleMentions: [],
      }),
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { useSelectionDiversification: false },
      }),
    );

    expect(diversifiedSpy).not.toHaveBeenCalled();
    expect(classicSpy).toHaveBeenCalledTimes(1);

    const [inputRows, minScore, budget] = classicSpy.mock.calls[0]!;
    const expected = RelevanceSelection.applyRelevanceSelection(
      inputRows!,
      minScore!,
      budget!,
    );
    expect(classicSpy.mock.results[0]?.value).toEqual(expected);
  });

  const sleepMs = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const buildIndexedSources = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${String(index).padStart(8, "0")}-0000-4000-8000-000000000001`,
      url: `https://example.com/news/article-${String(index)}`,
      title: `Indexed headline ${String(index)} ${VALID_SOURCE_TITLE}`,
      content: validSourceContent(),
      tickerId: "ticker-1",
      createdAt: new Date(
        `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      ),
    }));

  const mockIndexedExtraction = (
    sources: ReturnType<typeof buildIndexedSources>,
    delayForIndex: (index: number) => number,
  ): void => {
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockImplementation(
      async (params) => {
        const rawUserContent = params.messages.find(
          (message) => message.role === "user",
        )?.content;
        const userContent =
          typeof rawUserContent === "string" ? rawUserContent : "";
        const index = sources.findIndex((row) =>
          userContent.includes(row.title),
        );
        if (index < 0) {
          throw new Error("unknown source in extraction mock");
        }
        await sleepMs(delayForIndex(index));
        return llmResult({
          entities: [
            {
              canonicalName: `Entity-${String(index)}`,
              typeId: TYPE_ID,
              aliases: [],
            },
          ],
          relations: [],
          articleMentions: [],
        });
      },
    );
  };

  it("preserves merged entity order under parallel extraction", async () => {
    const sources = buildIndexedSources(5);

    const runWithConcurrency = async (concurrency: number) => {
      mockIndexedExtraction(sources, (index) => (index === 3 ? 1000 : 10));
      analysisGet.mockResolvedValue(
        analysisGetOk({
          dataSources: sources,
          entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
          relationTypes: [{ id: REL_ID, name: "r", description: null }],
          existingEntities: [],
          relevanceSelectionState,
          lastRelevanceScoredAtIso: null,
        }),
      );
      analysisCreate.mockResolvedValue({
        entitiesCreated: 5,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 5,
        articlesSelected: 5,
      });

      const result = await run(
        runContext({
          input: { tickerId: "ticker-1" },
          config: { extractionConcurrency: concurrency, maxBatchSize: 5 },
        }),
      );

      expect(result.success).toBe(true);
      return analysisCreate.mock.calls[0]?.[0]?.entities.map(
        (entity: { canonicalName: string }) => entity.canonicalName,
      );
    };

    const sequentialOrder = await runWithConcurrency(1);
    analysisGet.mockReset();
    analysisCreate.mockReset();
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockReset();

    const parallelOrder = await runWithConcurrency(4);

    expect(parallelOrder).toEqual(sequentialOrder);
    expect(parallelOrder).toEqual([
      "Entity-0",
      "Entity-1",
      "Entity-2",
      "Entity-3",
      "Entity-4",
    ]);
  });

  it("completes partial success when run deadline skips remaining sources", async () => {
    const sources = buildIndexedSources(10);
    mockIndexedExtraction(sources, () => 100);

    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: sources,
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 2,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 2,
      articlesSelected: 2,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {
          extractionConcurrency: 1,
          runDeadlineMs: 200,
          maxBatchSize: 10,
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.details?.extractionSuccessCount).toBe(2);
    expect(analysisCreate).toHaveBeenCalled();

    const summaryCall = mockLog.info.mock.calls.find(
      (call) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        (call[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(
      (
        summaryCall?.[0] as {
          parallelism?: { extractionSkippedDueToDeadline: number };
        }
      ).parallelism?.extractionSkippedDueToDeadline,
    ).toBe(8);
  });

  it("emits one yield snapshot log per run with stage attribution", async () => {
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: paywallSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
          {
            id: DS_ID_2,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: `${validSourceContent()} Apple expanded manufacturing capacity this year.`,
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue(
      llmResult({
        entities: [
          { canonicalName: "FakeCo", typeId: TYPE_ID, aliases: [] },
          { canonicalName: "Apple", typeId: TYPE_ID, aliases: [] },
        ],
        relations: [],
        articleMentions: [],
      }),
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {
          maxBatchSize: 2,
          entityGroundingPolicy: "drop",
          useSelectionDiversification: true,
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.details?.yieldSnapshot).toMatchObject({
      batchSize: 2,
      passed: expect.objectContaining({
        qualityGate: expect.any(Number),
        grounding: expect.any(Number),
        vocabulary: expect.any(Number),
      }),
      dropped: expect.objectContaining({
        byContentQuality: expect.any(Object),
        byGrounding: expect.objectContaining({
          entities: expect.any(Number),
        }),
      }),
      ratios: expect.objectContaining({
        extractionYield: expect.any(Number),
      }),
      latency: expect.objectContaining({
        extractionMsP50: expect.any(Number),
      }),
    });

    const summaryLogs = mockLog.info.mock.calls.filter(
      (call) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        (call[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    const yieldLogs = mockLog.info.mock.calls.filter(
      (call) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        (call[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_YIELD_SNAPSHOT_MESSAGE,
    );

    expect(summaryLogs).toHaveLength(1);
    expect(yieldLogs).toHaveLength(1);
    expect(yieldLogs[0]?.[1]).toBe(ARTICLE_ANALYSIS_YIELD_SNAPSHOT_MESSAGE);
    expect(yieldLogs[0]?.[0]).toMatchObject({
      event: ARTICLE_ANALYSIS_YIELD_SNAPSHOT_MESSAGE,
      batchSize: 2,
    });
  });

  it("recovers a transient extraction failure via retry and reports recoveredByRetry in the run summary", async () => {
    // Setup
    const { NoObjectGeneratedError } = await import("ai");
    const noResponseError = new NoObjectGeneratedError({
      message: "No object generated: the model did not return a response.",
      response: { id: "r", modelId: "gpt-4o-mini", timestamp: new Date() },
      usage: {
        inputTokens: 0,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
        outputTokens: 0,
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: undefined,
        },
        totalTokens: 0,
      },
      finishReason: "stop",
    });
    const goodResult = llmResult({
      entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
      relations: [],
      articleMentions: [],
    });
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
          {
            id: DS_ID_2,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
          {
            id: DS_ID_3,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource")
      .mockResolvedValueOnce(goodResult)
      .mockRejectedValueOnce(noResponseError)
      .mockResolvedValueOnce(goodResult)
      .mockResolvedValueOnce(goodResult);
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    // Act
    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {
          extractionTransientRetries: 2,
          extractionTransientRetryBaseDelayMs: 1,
          extractionTransientRetryMaxDelayMs: 1,
        },
      }),
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.details?.extractionFailures).toHaveLength(0);

    const summaryCall = mockLog.info.mock.calls.find(
      (call) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        (call[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(summaryCall).toBeDefined();
    expect(
      (summaryCall?.[0] as { extractionRetries?: { recoveredByRetry: number } })
        .extractionRetries?.recoveredByRetry,
    ).toBe(1);
    expect(
      (summaryCall?.[0] as { extractionFailuresLlm: number })
        .extractionFailuresLlm,
    ).toBe(0);
  });

  it("recovers from length-truncation via budget escalation and reports recoveredByRetry", async () => {
    // Setup
    const { NoObjectGeneratedError } = await import("ai");
    const lengthTruncationError = new NoObjectGeneratedError({
      message: "No object generated: the model did not return a response.",
      response: { id: "r", modelId: "gpt-4o-mini", timestamp: new Date() },
      usage: {
        inputTokens: 1000,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
        outputTokens: 8192,
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: undefined,
        },
        totalTokens: 9192,
      },
      finishReason: "length",
    });
    const goodResult = llmResult({
      entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
      relations: [],
      articleMentions: [],
    });
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    const capturedMaxOutputTokens: number[] = [];
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockImplementation(
      async (params) => {
        capturedMaxOutputTokens.push(params.maxOutputTokens);
        if (capturedMaxOutputTokens.length === 1) {
          throw lengthTruncationError;
        }

        return goodResult;
      },
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    // Act
    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {
          extractionMaxOutputTokens: 8192,
          extractionTransientRetries: 2,
          extractionTransientRetryBaseDelayMs: 1,
          extractionTransientRetryMaxDelayMs: 1,
        },
      }),
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.details?.extractionFailures).toHaveLength(0);
    expect(capturedMaxOutputTokens).toHaveLength(2);
    expect(capturedMaxOutputTokens[1]).toBeGreaterThan(
      capturedMaxOutputTokens[0]!,
    );

    const summaryCall = mockLog.info.mock.calls.find(
      (call) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        (call[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(summaryCall).toBeDefined();
    expect(
      (summaryCall?.[0] as { extractionRetries?: { recoveredByRetry: number } })
        .extractionRetries?.recoveredByRetry,
    ).toBe(1);
  });

  it("recovers from a call timeout and reports extractionCallTimeouts in the run summary", async () => {
    const timeoutError = Object.assign(new Error("The operation timed out"), {
      name: "TimeoutError",
    });
    const goodResult = llmResult({
      entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
      relations: [],
      articleMentions: [],
    });
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    let extractionCallCount = 0;
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockImplementation(
      async (_params) => {
        extractionCallCount++;
        if (extractionCallCount === 1) {
          throw timeoutError;
        }

        return goodResult;
      },
    );
    analysisCreate.mockResolvedValue({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 1,
      articlesSelected: 1,
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {
          extractionTransientRetries: 2,
          extractionTransientRetryBaseDelayMs: 1,
          extractionTransientRetryMaxDelayMs: 1,
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.details?.extractionFailures).toHaveLength(0);

    const summaryCall = mockLog.info.mock.calls.find(
      (call) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        (call[0] as { event?: string }).event ===
          ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    expect(summaryCall).toBeDefined();
    expect(
      (summaryCall?.[0] as { extractionCallTimeouts?: number })
        .extractionCallTimeouts,
    ).toBe(1);
  });

  it("surfaces a source as an llm failure when every extraction attempt times out", async () => {
    const timeoutError = Object.assign(new Error("The operation timed out"), {
      name: "TimeoutError",
    });
    analysisGet.mockResolvedValue(
      analysisGetOk({
        dataSources: [
          {
            id: DS_ID,
            url: VALID_SOURCE_URL,
            title: VALID_SOURCE_TITLE,
            content: validSourceContent(),
            tickerId: "ticker-1",
            createdAt: new Date(),
          },
        ],
        entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
        relationTypes: [{ id: REL_ID, name: "r", description: null }],
        existingEntities: [],
        relevanceSelectionState,
        lastRelevanceScoredAtIso: null,
      }),
    );
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockRejectedValue(
      timeoutError,
    );

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {
          extractionTransientRetries: 1,
          extractionTransientRetryBaseDelayMs: 1,
          extractionTransientRetryMaxDelayMs: 1,
          runPolicy: { minSuccessfulSources: 0 },
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.details?.extractionFailures).toHaveLength(1);
    expect(result.details?.extractionFailures?.[0]?.stage).toBe("llm");
    expect(
      (result.details?.extractionFailures?.[0] as { reason?: string })?.reason,
    ).toBe("timeout");
  });
});
