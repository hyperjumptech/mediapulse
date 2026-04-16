/** @vitest-environment node */
import type { AgentRunContext } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
      });

    analysisCreate.mockResolvedValueOnce({
      entitiesCreated: 1,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 0,
      articlesSelected: 0,
    });

    const result = await run(runContext({ input: { tickerId: "ticker-1" } }));

    expect(result.success).toBe(true);
    expect(result.details).toMatchObject({
      vocabularyFailures: 1,
      entitiesCreated: 1,
    });
    expect(analysisCreate).toHaveBeenCalledTimes(1);
  });

  it("posts chunks and aggregates POST response counts", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [source],
      entityTypes: [{ id: TYPE_ID, name: "Co", description: null }],
      relationTypes: [{ id: REL_ID, name: "r", description: null }],
      existingEntities: [],
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
      });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: { postChunkRelationBatchSize: 1 },
      }),
    );

    expect(result.success).toBe(true);
    expect(analysisCreate).toHaveBeenCalledTimes(2);
    expect(result.details).toMatchObject({
      postChunks: 2,
      entitiesCreated: 2,
      entitiesReused: 2,
      relationsCreated: 2,
    });
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
    });

    analysisCreate.mockResolvedValueOnce({
      entitiesCreated: 1,
      entitiesReused: 1,
      relationsCreated: 1,
      articlesScored: 0,
      articlesSelected: 0,
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

  it("logs verbose start", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
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
