/** @vitest-environment node */
import type { AgentRunContext } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as RelevancePostChunks from "./analysis-relevance-post-chunks.js";
import * as Llm from "./llm-extract-entities.js";
import type { ArticleAnalysisConfig } from "./config-schema.js";
import type { ArticleAnalysisInput } from "./input-schema.js";
import { run } from "./run.js";

const analysisGet = vi.fn();
const analysisCreate = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    analysis: {
      get: analysisGet,
      create: analysisCreate,
    },
  })),
}));

vi.mock("@mediapulse/env/agents-article-analysis", () => ({
  env: {
    AGENT_DATA_API_URL: "http://localhost:8081",
  },
}));

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const TYPE_ID = "11111111-1111-4111-a111-111111111111";
const REL_ID = "22222222-2222-4222-a222-222222222222";
const DS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DS_ID_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Required on `analysis.get` responses (see `getAnalysisResponseSchema`). */
const relevanceSelectionState = {
  utcDayStartIso: "2026-04-09T00:00:00.000Z",
  selectedCountToday: 0,
} as const;

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
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const source = {
    id: DS_ID,
    url: "u",
    title: "T",
    content: "c",
    tickerId: "ticker-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("returns success when no data sources after GET", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
      relevanceSelectionState,
    });

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(true);
    expect(result.message).toContain("0 source(s)");
    expect(analysisCreate).not.toHaveBeenCalled();
  });

  it("uses unanalyzed false when reanalyze with maxBatchSize", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
      relevanceSelectionState,
    });

    await run(
      runContext({
        input: {
          tickerId: "ticker-r",
          reanalyze: true,
          maxBatchSize: 3,
        },
      }),
    );

    expect(analysisGet).toHaveBeenCalledWith({
      tickerId: "ticker-r",
      unanalyzed: false,
    });
  });

  it("passes timeWindow as start and end on GET", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
      relevanceSelectionState,
    });

    await run(
      runContext({
        input: {
          tickerId: "ticker-w",
          timeWindow: {
            start: "2026-01-01T00:00:00.000Z",
            end: "2026-01-31T00:00:00.000Z",
          },
        },
      }),
    );

    expect(analysisGet).toHaveBeenCalledWith({
      tickerId: "ticker-w",
      unanalyzed: true,
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-31T00:00:00.000Z",
    });
  });

  it("fails when vocabulary is empty", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [source],
      entityTypes: [],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
      relevanceSelectionState,
    });

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("vocabulary");
  });

  it("skips vocabulary-invalid slices and continues processing others", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [
        source,
        {
          ...source,
          id: DS_ID_2,
          title: "T2",
        },
      ],
      entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
      relevanceSelectionState,
    });

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource")
      .mockResolvedValueOnce({
        entities: [
          {
            canonicalName: "Bad",
            typeId: "99999999-9999-4999-a999-999999999999",
            aliases: [],
          },
        ],
        relations: [],
        articleMentions: [],
      })
      .mockResolvedValueOnce({
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
      });

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
    analysisGet.mockResolvedValue({
      dataSources: [source],
      entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
      relevanceSelectionState,
    });

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue({
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
    });

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
    analysisGet.mockResolvedValue({
      dataSources: [
        {
          id: DS_ID,
          url: "u",
          title: "T",
          content: "c",
          tickerId: "ticker-1",
          createdAt: new Date(),
        },
      ],
      entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
      relevanceSelectionState,
    });

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue({
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
    });

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
    analysisGet.mockResolvedValue({
      dataSources: [
        {
          id: DS_ID,
          url: "u",
          title: "T",
          content: "c",
          tickerId: "ticker-1",
          createdAt: new Date(),
        },
      ],
      entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
      relevanceSelectionState,
    });

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue({
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
    });

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
    analysisGet.mockResolvedValue({
      dataSources: [
        {
          id: DS_ID,
          url: "u",
          title: "T",
          content: "c",
          tickerId: "ticker-1",
          createdAt: new Date(),
        },
      ],
      entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
      relevanceSelectionState,
    });

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue({
      entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
      relations: [],
      articleMentions: [],
    });

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
  });

  it("fails run when relevance chunk parse errors are reported", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [
        {
          id: DS_ID,
          url: "u",
          title: "T",
          content: "c",
          tickerId: "ticker-1",
          createdAt: new Date(),
        },
      ],
      entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
      relevanceSelectionState,
    });

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue({
      entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
      relations: [],
      articleMentions: [],
    });

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
  });

  it("returns failure when analysis GET throws", async () => {
    analysisGet.mockRejectedValue(new Error("upstream error"));

    const result = await run(runContext({ input: { tickerId: "ticker-3" } }));

    expect(result).toEqual({
      success: false,
      message: "upstream error",
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it("resolves extracted names to existing canonical entities before POST", async () => {
    analysisGet.mockResolvedValue({
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
    });

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue({
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
    });

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
    analysisGet.mockResolvedValue({
      dataSources: [
        {
          id: DS_ID,
          url: "u1",
          title: "T1",
          content: "c",
          tickerId: "ticker-1",
          createdAt: new Date(),
        },
        {
          id: DS_ID_2,
          url: "u2",
          title: "T2",
          content: "c",
          tickerId: "ticker-1",
          createdAt: new Date(),
        },
      ],
      entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
      relevanceSelectionState,
    });

    let extractCall = 0;
    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockImplementation(
      async () => {
        extractCall += 1;
        if (extractCall === 1) {
          return {
            entities: [
              {
                canonicalName: "Bad",
                typeId: "99999999-9999-4999-a999-999999999999",
                aliases: [],
              },
            ],
            relations: [],
            articleMentions: [],
          };
        }
        return {
          entities: [{ canonicalName: "A", typeId: TYPE_ID, aliases: [] }],
          relations: [],
          articleMentions: [],
        };
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
  });

  it("stops POST phases after ER chunk failure and records postFailures", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [
        {
          id: DS_ID,
          url: "u",
          title: "T",
          content: "c",
          tickerId: "ticker-1",
          createdAt: new Date(),
        },
      ],
      entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
      relevanceSelectionState,
    });

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue({
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
    });

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

  it("fails run when extraction successes are below runPolicy minimum", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [
        {
          id: DS_ID,
          url: "u",
          title: "T",
          content: "c",
          tickerId: "ticker-1",
          createdAt: new Date(),
        },
        {
          id: DS_ID_2,
          url: "u2",
          title: "T2",
          content: "c",
          tickerId: "ticker-1",
          createdAt: new Date(),
        },
      ],
      entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
      relevanceSelectionState,
    });

    vi.spyOn(Llm, "extractEntitiesAndRelationsForSource").mockResolvedValue({
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

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(false);
    expect(result.message).toContain("run policy");
    expect(analysisCreate).not.toHaveBeenCalled();
  });

  it("logs verbose start", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
      relevanceSelectionState,
    });

    await run(
      runContext({
        input: { tickerId: "tv" },
        config: { verbose: true },
      }),
    );

    expect(logger.info).toHaveBeenCalled();
  });
});
