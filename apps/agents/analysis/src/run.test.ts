/** @vitest-environment node */
import type { AgentRunContext } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config, Input } from "./index";
import { extractEntities } from "./extract-entities.js";
import { run } from "./run";

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("./extract-entities.js", () => ({
  extractEntities: vi.fn(),
}));

const baseConfig: Config = {
  openAiApiKey: "test-openai-api-key",
  openAiModel: "gpt-4o-mini",
  weights: {
    aliasMatch: 0.3,
    entityOverlap: 0.3,
    freshness: 0.2,
    sourceQuality: 0.1,
    novelty: 0.1,
  },
  maxSelected: 10,
  minScoreThreshold: 0.25,
  trustedDomains: { "reuters.com": 0.9 },
};

/** Builds a minimal run context for tests; token is not used by run. */
function runContext(overrides: {
  input: Input;
  config: Config;
  token?: string;
}): AgentRunContext<Input, Config> {
  return { ...overrides, token: overrides.token };
}

describe("run", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns skipped when no unanalyzed articles exist", async () => {
    // Setup
    const dataApiGetFn = vi.fn().mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
    });
    const dataApiPostFn = vi.fn().mockResolvedValue("{}");
    const ctx = runContext({
      input: { tickerId: "b4a11f54-e955-481d-9128-2e96d15fe80f" },
      config: baseConfig,
    });

    // Act
    const result = await run(ctx, { dataApiGetFn, dataApiPostFn });

    // Assert
    expect(result).toEqual({ success: true, skipped: true });
    expect(dataApiPostFn).not.toHaveBeenCalled();
  });

  it("orchestrates extraction, scoring, and single post", async () => {
    // Setup
    vi.mocked(extractEntities).mockResolvedValue({
      entities: [
        {
          canonicalName: "Bank Central Asia",
          typeId: "et-org",
          aliases: ["BBCA"],
          description: undefined,
        },
      ],
      relations: [],
      articleEntities: [
        {
          dataSourceId: "d1",
          entityName: "Bank Central Asia",
          mentionCount: 1,
          confidence: 0.7,
        },
      ],
      articleEntityNamesByDataSourceId: { d1: ["Bank Central Asia"] },
      failedArticleIds: [],
    });
    const dataApiGetFn = vi.fn().mockResolvedValue({
      dataSources: [
        {
          id: "d1",
          url: "https://reuters.com/d1",
          title: "BBCA posts earnings growth",
          content: "Bank Central Asia and OJK discussions",
          tickerId: "95f66831-48c0-4da4-b8e2-184b4869f6d5",
          createdAt: new Date("2026-03-19T00:00:00.000Z"),
        },
      ],
      entityTypes: [{ id: "et-org", name: "ORG", description: null }],
      relationTypes: [
        { id: "rt-reg", name: "REGULATED_BY", description: null },
      ],
      existingEntities: [
        {
          id: "e1",
          canonicalName: "Bank Central Asia",
          typeId: "et-org",
          aliases: ["BBCA"],
        },
      ],
    });
    const dataApiPostFn = vi.fn().mockResolvedValue("{}");
    const ctx = runContext({
      input: { tickerId: "95f66831-48c0-4da4-b8e2-184b4869f6d5" },
      token: "Bearer abc",
      config: baseConfig,
    });

    // Act
    const result = await run(ctx, {
      dataApiGetFn,
      dataApiPostFn,
    });

    // Assert
    expect(result).toEqual({ success: true });
    expect(dataApiPostFn).toHaveBeenCalledTimes(1);
    const postPayload = dataApiPostFn.mock.calls[0]?.[3] as {
      entities: unknown[];
      relations: unknown[];
      articleEntities: unknown[];
      articleRelevances: Array<{ dataSourceId: string; selected: boolean }>;
    };
    expect(postPayload.entities).toHaveLength(1);
    expect(postPayload.relations).toHaveLength(0);
    expect(postPayload.articleEntities).toHaveLength(1);
    expect(postPayload.articleRelevances).toHaveLength(1);
    expect(postPayload.articleRelevances[0]?.dataSourceId).toBe("d1");
  });

  it("posts remaining scored articles when extraction partially fails", async () => {
    // Setup
    vi.mocked(extractEntities).mockResolvedValue({
      entities: [
        { canonicalName: "BBCA", typeId: "et-org", aliases: ["BBCA"] },
      ],
      relations: [],
      articleEntities: [
        {
          dataSourceId: "p1",
          entityName: "BBCA",
          mentionCount: 1,
          confidence: 0.7,
        },
      ],
      articleEntityNamesByDataSourceId: { p1: ["BBCA"] },
      failedArticleIds: ["p2"],
    });
    const dataApiGetFn = vi.fn().mockResolvedValue({
      dataSources: [
        {
          id: "p1",
          url: "https://bisnis.com/p1",
          title: "BBCA expansion update",
          content: "Bank Central Asia expands services",
          tickerId: "44f66831-48c0-4da4-b8e2-184b4869f6d5",
          createdAt: new Date("2026-03-19T00:00:00.000Z"),
        },
        {
          id: "p2",
          url: "https://example.com/p2",
          title: "Unparseable article",
          content: "Will fail extraction",
          tickerId: "44f66831-48c0-4da4-b8e2-184b4869f6d5",
          createdAt: new Date("2026-03-19T00:00:00.000Z"),
        },
      ],
      entityTypes: [{ id: "et-org", name: "ORG", description: null }],
      relationTypes: [],
      existingEntities: [
        {
          id: "e1",
          canonicalName: "Bank Central Asia",
          typeId: "et-org",
          aliases: ["BBCA"],
        },
      ],
    });
    const dataApiPostFn = vi.fn().mockResolvedValue("{}");
    const warnSpy = vi.spyOn(logger, "warn");
    const ctx = runContext({
      input: { tickerId: "44f66831-48c0-4da4-b8e2-184b4869f6d5" },
      config: {
        ...baseConfig,
        verbose: true,
        minScoreThreshold: 0.1,
        trustedDomains: { "bisnis.com": 0.85 },
      },
    });

    // Act
    const result = await run(ctx, {
      dataApiGetFn,
      dataApiPostFn,
    });

    // Assert
    expect(result).toEqual({ success: true });
    expect(dataApiPostFn).toHaveBeenCalledTimes(1);
    const postPayload = dataApiPostFn.mock.calls[0]?.[3] as {
      articleRelevances: Array<{ dataSourceId: string }>;
    };
    expect(postPayload.articleRelevances.length).toBeGreaterThan(0);
    expect(
      postPayload.articleRelevances.every((row) => row.dataSourceId !== "p2"),
    ).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      { failedArticleIds: ["p2"] },
      "Some articles failed extraction but remaining articles were scored",
    );
  });

  it("calls analysis GET with unanalyzed true query", async () => {
    // Setup
    const dataApiGetFn = vi.fn().mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
    });
    const dataApiPostFn = vi.fn().mockResolvedValue("{}");
    const ctx = runContext({
      input: { tickerId: "75f66831-48c0-4da4-b8e2-184b4869f6d5" },
      config: baseConfig,
    });

    // Act
    await run(ctx, { dataApiGetFn, dataApiPostFn });

    // Assert
    expect(dataApiGetFn).toHaveBeenCalledWith(
      undefined,
      expect.any(String),
      "/api/analysis",
      {
        tickerId: "75f66831-48c0-4da4-b8e2-184b4869f6d5",
        unanalyzed: "true",
      },
    );
  });
});
