/** @vitest-environment node */
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// --- Interfaces untuk Typing yang Aman ---
interface MockQuery {
  id: string;
  text: string;
  source: string;
  intent: string;
  rank: number;
  setId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockCreateArgs {
  queries: MockQuery[];
  activate: boolean;
  generationSource: string;
  agentJobId: string | null;
  strategySnapshot: Record<string, unknown>;
}

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const AUTH_HEADERS = {
  Authorization: "Bearer test-token",
  "Content-Type": "application/json",
};

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mediapulse/env/agents-query-analysis", () => ({
  env: {
    AGENT_DATA_API_URL: "http://data-api.example.com",
    AGENT_AUTH_API_URL: "http://auth.example.com",
    PORT: undefined,
    AGENT_REGISTRY_URL: undefined,
    AGENT_PUBLIC_URL: undefined,
    DOMAIN_INTEGRATION_API_KEY: undefined,
    DOMAIN_INTEGRATION_ID: undefined,
    OPENAI_API_KEY: undefined,
    OPENAI_MODEL: undefined,
    QUERY_ANALYSIS_QUERY_COUNT: undefined,
    QUERY_ANALYSIS_ALLOWED_LANGUAGES: undefined,
    QUERY_ANALYSIS_MIN_DETERMINISTIC_COUNT: undefined,
    QUERY_ANALYSIS_WEIGHT_BREAKING: undefined,
    QUERY_ANALYSIS_WEIGHT_KG_CHANGE: undefined,
    QUERY_ANALYSIS_WEIGHT_FUNDAMENTAL: undefined,
    QUERY_ANALYSIS_MODEL: undefined,
    QUERY_ANALYSIS_MAX_TOKENS: undefined,
  },
}));

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const queryAnalysisGetMock = vi.fn();
const queryAnalysisCreateMock = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    queryAnalysis: {
      get: queryAnalysisGetMock,
      create: queryAnalysisCreateMock,
    },
  })),
}));

const MOCK_CONTEXT = {
  ticker: {
    id: TICKER_ID,
    symbol: "AAPL",
    name: "Apple Inc.",
    metadata: null,
  },
  topEntities: [
    { canonicalName: "Tim Cook", typeName: "Person", relevanceWeight: 0.9 },
    { canonicalName: "iPhone", typeName: "Product", relevanceWeight: 0.8 },
  ],
  recentThemes: [],
  configSnapshot: {
    queryCount: 10,
    allowedLanguages: ["en"],
    minDeterministicCount: 3,
    weightBreaking: 0.5,
    weightKgChange: 0.3,
    weightFundamental: 0.2,
    model: "gpt-4o",
    maxTokens: 1000,
  },
};

const MOCK_CREATE_RESULT = {
  created: 5,
  createdSetId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  activeSetId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
};

let app: Awaited<typeof import("../src/index.js")>["app"];

beforeAll(async () => {
  const module = await import("../src/index.js");
  app = module.app;
}, 30_000);

const post = async (
  body: unknown,
  extraHeaders: Record<string, string> = {},
) => {
  return app.request("http://localhost/", {
    method: "POST",
    headers: { ...AUTH_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  });
};

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("query-analysis agent – input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryAnalysisGetMock.mockResolvedValue(MOCK_CONTEXT);
    queryAnalysisCreateMock.mockResolvedValue(MOCK_CREATE_RESULT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when tickerId is missing", async () => {
    const res = await post({ input: {} });
    expect(res.status).toBe(400);
  });

  it("returns 400 when tickerId is not a valid UUID", async () => {
    const res = await post({ input: { tickerId: "not-a-uuid" } });
    expect(res.status).toBe(400);
  });

  it("returns 200 when tickerId is a valid UUID", async () => {
    const res = await post({ input: { tickerId: TICKER_ID } });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Deterministic-only run (no OpenAI key)
// ---------------------------------------------------------------------------

describe("query-analysis agent – deterministic-only run (no OpenAI key)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryAnalysisGetMock.mockResolvedValue(MOCK_CONTEXT);
    queryAnalysisCreateMock.mockResolvedValue(MOCK_CREATE_RESULT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with Hermes success envelope", async () => {
    const res = await post({ input: { tickerId: TICKER_ID } });
    const body = (await res.json()) as {
      schemaVersion: number;
      status: string;
    };

    expect(res.status).toBe(200);
    expect(body.schemaVersion).toBe(1);
    expect(body.status).toBe("success");
  });

  it("fetches context via queryAnalysis.get with the correct tickerId", async () => {
    await post({ input: { tickerId: TICKER_ID } });
    expect(queryAnalysisGetMock).toHaveBeenCalledWith({ tickerId: TICKER_ID });
  });

  it("calls queryAnalysis.create once with only deterministic queries", async () => {
    await post({ input: { tickerId: TICKER_ID } });

    expect(queryAnalysisCreateMock).toHaveBeenCalledOnce();
    // FIX: Added non-null assertion (!) and interface
    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.queries.length).toBeGreaterThan(0);
    expect(args.queries.every((q) => q.source === "deterministic")).toBe(true);
  });

  it("sets activate: true and generationSource: hybrid_v1", async () => {
    await post({ input: { tickerId: TICKER_ID } });

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.activate).toBe(true);
    expect(args.generationSource).toBe("hybrid_v1");
  });

  it("all generated queries have a valid intent", async () => {
    await post({ input: { tickerId: TICKER_ID } });

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    const validIntents = ["breaking", "kg_change", "fundamental"];
    for (const q of args.queries) {
      expect(validIntents).toContain(q.intent);
    }
  });

  it("queries have monotonically increasing rank starting at 1", async () => {
    await post({ input: { tickerId: TICKER_ID } });

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    const ranks = args.queries.map((q) => q.rank);
    expect(ranks[0]).toBe(1);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBe(ranks[i - 1]! + 1);
    }
  });

  it("passes agentJobId from input body to queryAnalysis.create", async () => {
    await post({ input: { tickerId: TICKER_ID, agentJobId: "job-input-123" } });

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.agentJobId).toBe("job-input-123");
  });

  it("prefers X-Job-Id header over input.agentJobId", async () => {
    await post(
      { input: { tickerId: TICKER_ID, agentJobId: "job-from-input" } },
      { "X-Job-Id": "job-from-header" },
    );

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.agentJobId).toBe("job-from-header");
  });

  it("sets agentJobId to null when neither header nor input provides it", async () => {
    await post({ input: { tickerId: TICKER_ID } });

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.agentJobId).toBeNull();
  });

  it("strategySnapshot includes the effective config values", async () => {
    await post({ input: { tickerId: TICKER_ID } });

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.strategySnapshot).toMatchObject({
      queryCount: expect.any(Number),
      allowedLanguages: expect.any(Array),
      minDeterministicCount: expect.any(Number),
      weightBreaking: expect.any(Number),
      weightKgChange: expect.any(Number),
      weightFundamental: expect.any(Number),
      model: expect.any(String),
      maxTokens: expect.any(Number),
    });
  });
});

// ---------------------------------------------------------------------------
// LLM-assisted run (openaiApiKey provided via config)
// ---------------------------------------------------------------------------

describe("query-analysis agent – LLM-assisted run (openaiApiKey in config)", () => {
  const LLM_CONFIG = { openaiApiKey: "sk-test-key" };

  const stubOpenAiSuccess = (
    queries: Array<{ text: string; intent: string }>,
  ) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ queries }) } }],
        }),
      }),
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryAnalysisGetMock.mockResolvedValue(MOCK_CONTEXT);
    queryAnalysisCreateMock.mockResolvedValue(MOCK_CREATE_RESULT);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns 200 with success status when LLM responds successfully", async () => {
    stubOpenAiSuccess([
      { text: "Apple Q1 2025 earnings beat", intent: "fundamental" },
    ]);

    const res = await post({
      input: { tickerId: TICKER_ID },
      config: LLM_CONFIG,
    });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
  });

  it("includes llm-sourced queries in the persisted set", async () => {
    stubOpenAiSuccess([
      { text: "Apple supply chain news", intent: "breaking" },
    ]);

    await post({ input: { tickerId: TICKER_ID }, config: LLM_CONFIG });

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.queries.some((q) => q.source === "llm")).toBe(true);
  });

  it("deduplicates: an llm query identical to a deterministic baseline is dropped", async () => {
    stubOpenAiSuccess([
      { text: "AAPL latest news", intent: "breaking" },
      { text: "Apple Inc. supply chain concerns", intent: "breaking" },
    ]);

    await post({ input: { tickerId: TICKER_ID }, config: LLM_CONFIG });

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    const lowered = args.queries.map((q) => q.text.toLowerCase());
    const dupeCount = lowered.filter((t) => t === "aapl latest news").length;
    expect(dupeCount).toBe(1);
  });

  it("respects queryCount: final query list length does not exceed the limit", async () => {
    stubOpenAiSuccess(
      Array.from({ length: 30 }, (_, i) => ({
        text: `LLM unique query ${i}`,
        intent: "breaking",
      })),
    );

    const queryCount = 5;
    await post({
      input: { tickerId: TICKER_ID },
      config: { ...LLM_CONFIG, queryCount },
    });

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.queries.length).toBeLessThanOrEqual(queryCount);
  });

  it("strategySnapshot reflects overridden config values", async () => {
    stubOpenAiSuccess([]);

    const configOverride = {
      openaiApiKey: "sk-key",
      queryCount: 7,
      model: "gpt-4o-mini",
      weightBreaking: 0.8,
    };
    await post({ input: { tickerId: TICKER_ID }, config: configOverride });

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.strategySnapshot.queryCount).toBe(7);
    expect(args.strategySnapshot.model).toBe("gpt-4o-mini");
    expect(args.strategySnapshot.weightBreaking).toBe(0.8);
  });

  it("falls back to deterministic-only set when fetch throws a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network unreachable")),
    );

    const res = await post({
      input: { tickerId: TICKER_ID },
      config: LLM_CONFIG,
    });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.queries.every((q) => q.source === "deterministic")).toBe(true);
  });

  it("falls back to deterministic-only set when OpenAI returns a non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: "rate limit" }),
      }),
    );

    const res = await post({
      input: { tickerId: TICKER_ID },
      config: LLM_CONFIG,
    });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");

    const args = queryAnalysisCreateMock.mock.calls[0]![0] as MockCreateArgs;
    expect(args.queries.every((q) => q.source === "deterministic")).toBe(true);
  });

  it("falls back gracefully when OpenAI returns malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not valid json {{" } }],
        }),
      }),
    );

    const res = await post({
      input: { tickerId: TICKER_ID },
      config: LLM_CONFIG,
    });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
  });
});

// ---------------------------------------------------------------------------
// Downstream API failures
// ---------------------------------------------------------------------------

describe("query-analysis agent – downstream API failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 500 when queryAnalysis.get throws", async () => {
    queryAnalysisGetMock.mockRejectedValue(new Error("Data API unreachable"));
    queryAnalysisCreateMock.mockResolvedValue(MOCK_CREATE_RESULT);

    const res = await post({ input: { tickerId: TICKER_ID } });
    expect(res.status).toBe(500);
  });

  it("returns 500 when queryAnalysis.create throws", async () => {
    queryAnalysisGetMock.mockResolvedValue(MOCK_CONTEXT);
    queryAnalysisCreateMock.mockRejectedValue(new Error("DB write failed"));

    const res = await post({ input: { tickerId: TICKER_ID } });
    expect(res.status).toBe(500);
  });

  it("does not call queryAnalysis.create when get fails", async () => {
    queryAnalysisGetMock.mockRejectedValue(new Error("timeout"));

    await post({ input: { tickerId: TICKER_ID } });
    expect(queryAnalysisCreateMock).not.toHaveBeenCalled();
  });
});
