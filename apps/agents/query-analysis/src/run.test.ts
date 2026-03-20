/** @vitest-environment node */
import type { AgentRunContext } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config, Input } from "./index";
import { run } from "./run";

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const baseConfig: Config = {
  openAiApiKey: "test-openai-api-key",
  openAiModel: "gpt-4o-mini",
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

  it("fetches context, generates exactly 8 queries, and posts them", async () => {
    // Setup
    const dataApiGetFn = vi.fn().mockResolvedValue({
      ticker: {
        id: "016ea4f4-b5f3-4e4f-973b-3863c1114f74",
        symbol: "BBRI",
        name: "Bank Rakyat Indonesia",
        metadata: {
          Sektor: "Financials",
          Industri: "Banking",
          SubIndustri: "Commercial Banks",
          KegiatanUsahaUtama: "Lending",
        },
      },
      topEntities: [
        { canonicalName: "BRI", typeName: "ORG", relevanceWeight: 0.9 },
      ],
      recentThemes: [{ theme: "digital bank", articleCount: 3 }],
    });
    const dataApiPostFn = vi.fn().mockResolvedValue("{}");
    const openAiClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    queries: Array.from({ length: 8 }, (_, index) => ({
                      text: `query-${index + 1}`,
                      angle: `angle-${index + 1}`,
                    })),
                  }),
                },
              },
            ],
          }),
        },
      },
    };
    const ctx = runContext({
      input: { tickerId: "016ea4f4-b5f3-4e4f-973b-3863c1114f74" },
      config: baseConfig,
      token: "Bearer token-123",
    });

    // Act
    const result = await run(ctx, {
      dataApiGetFn,
      dataApiPostFn,
      openAiClient,
    });

    // Assert
    expect(result).toEqual({ success: true });
    expect(dataApiGetFn).toHaveBeenCalledWith(
      "Bearer token-123",
      expect.any(String),
      "/api/query-analysis",
      { tickerId: "016ea4f4-b5f3-4e4f-973b-3863c1114f74" },
    );
    expect(dataApiPostFn).toHaveBeenCalledWith(
      "Bearer token-123",
      expect.any(String),
      "/api/query-analysis",
      {
        tickerId: "016ea4f4-b5f3-4e4f-973b-3863c1114f74",
        queries: [
          { text: "query-1" },
          { text: "query-2" },
          { text: "query-3" },
          { text: "query-4" },
          { text: "query-5" },
          { text: "query-6" },
          { text: "query-7" },
          { text: "query-8" },
        ],
      },
    );
  });

  it("logs generated angles when verbose is true", async () => {
    // Setup
    const dataApiGetFn = vi.fn().mockResolvedValue({
      ticker: {
        id: "316ea4f4-b5f3-4e4f-973b-3863c1114f74",
        symbol: "ASII",
        name: "Astra",
        metadata: null,
      },
      topEntities: [],
      recentThemes: [],
    });
    const dataApiPostFn = vi.fn().mockResolvedValue("{}");
    const openAiClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    queries: Array.from({ length: 8 }, (_, index) => ({
                      text: `q-${index + 1}`,
                      angle: `a-${index + 1}`,
                    })),
                  }),
                },
              },
            ],
          }),
        },
      },
    };
    const ctx = runContext({
      input: { tickerId: "316ea4f4-b5f3-4e4f-973b-3863c1114f74" },
      config: { ...baseConfig, verbose: true },
    });

    // Act
    await run(ctx, { dataApiGetFn, dataApiPostFn, openAiClient });

    // Assert
    expect(logger.info).toHaveBeenCalledWith(
      {
        tickerId: "316ea4f4-b5f3-4e4f-973b-3863c1114f74",
        queryAngles: ["a-1", "a-2", "a-3", "a-4", "a-5", "a-6", "a-7", "a-8"],
      },
      "Generated query-analysis angles",
    );
  });

  it("throws when OpenAI does not return exactly 8 queries", async () => {
    // Setup
    const dataApiGetFn = vi.fn().mockResolvedValue({
      ticker: {
        id: "416ea4f4-b5f3-4e4f-973b-3863c1114f74",
        symbol: "TLKM",
        name: "Telkom",
        metadata: null,
      },
      topEntities: [],
      recentThemes: [],
    });
    const dataApiPostFn = vi.fn().mockResolvedValue("{}");
    const openAiClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    queries: [{ text: "only-one", angle: "oops" }],
                  }),
                },
              },
            ],
          }),
        },
      },
    };
    const ctx = runContext({
      input: { tickerId: "416ea4f4-b5f3-4e4f-973b-3863c1114f74" },
      config: baseConfig,
    });

    // Act
    const act = () => run(ctx, { dataApiGetFn, dataApiPostFn, openAiClient });

    // Assert
    await expect(act).rejects.toThrow("must return exactly 8 queries");
    expect(dataApiPostFn).not.toHaveBeenCalled();
  });

  it("throws when OpenAI returns empty response content", async () => {
    // Setup
    const dataApiGetFn = vi.fn().mockResolvedValue({
      ticker: {
        id: "516ea4f4-b5f3-4e4f-973b-3863c1114f74",
        symbol: "BBNI",
        name: "Bank Negara Indonesia",
        metadata: null,
      },
      topEntities: [],
      recentThemes: [],
    });
    const dataApiPostFn = vi.fn().mockResolvedValue("{}");
    const openAiClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: null } }],
          }),
        },
      },
    };
    const ctx = runContext({
      input: { tickerId: "516ea4f4-b5f3-4e4f-973b-3863c1114f74" },
      config: baseConfig,
    });

    // Act
    const act = () => run(ctx, { dataApiGetFn, dataApiPostFn, openAiClient });

    // Assert
    await expect(act).rejects.toThrow(
      "OpenAI returned an empty query-analysis response",
    );
  });
});
