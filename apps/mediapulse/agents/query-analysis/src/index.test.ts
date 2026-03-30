import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@mediapulse/env/agents-query-analysis", () => ({
  env: {
    AGENT_DATA_API_URL:         "http://agent-data-api",
    AGENT_AUTH_API_URL:         "http://agent-auth",
    AGENT_REGISTRY_URL:         undefined,
    AGENT_PUBLIC_URL:           undefined,
    DOMAIN_INTEGRATION_API_KEY: undefined,
    DOMAIN_INTEGRATION_KEY:     "mediapulse",
    PORT:                       4004,
  },
}));

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

const mockGet    = vi.fn();
const mockCreate = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn().mockReturnValue({
    queryAnalysis: { get: mockGet, create: mockCreate },
  }),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "[]" } }],
        }),
      },
    },
  })),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

const AUTH = { Authorization: "Bearer test-token" };

const makeContext = () => ({
  ticker:       { id: TICKER_ID, symbol: "AAPL", name: "Apple Inc.", metadata: null },
  topEntities:  [{ canonicalName: "Tim Cook", typeName: "Person", relevanceWeight: 0.9 }],
  recentThemes: [{ theme: "iPhone", articleCount: 5 }],
});

const makeConfig = () => ({
  openaiApiKey:          "sk-test",
  openaiModel:           "gpt-4o-mini",
  queryCount:            8,
  minDeterministicCount: 4,
  allowedLanguages:      ["en"],
  weightBreaking:        3,
  weightKgChange:        2,
  weightFundamental:     1,
  maxTokens:             512,
});

const validBody = () => ({
  input:  { tickerId: TICKER_ID },
  config: makeConfig(),
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("query-analysis agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(makeContext());
    mockCreate.mockResolvedValue({
      created:     4,
      setId:       "33333333-3333-4333-a333-333333333333",
      activeSetId: "33333333-3333-4333-a333-333333333333",
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns 401 without Authorization header", async () => {
    const { default: server } = await import("./index.js");
    const res = await server.fetch(
      new Request("http://localhost/", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(validBody()),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("persists queries and returns success on happy path", async () => {
    const { default: server } = await import("./index.js");
    const res = await server.fetch(
      new Request("http://localhost/", {
        method:  "POST",
        headers: { ...AUTH, "Content-Type": "application/json" },
        body:    JSON.stringify(validBody()),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(mockGet).toHaveBeenCalledWith({ tickerId: TICKER_ID });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId:         TICKER_ID,
        generationSource: "hybrid_v1",
        strategySnapshot: expect.objectContaining({ queryCount: 8 }),
        queries:          expect.arrayContaining([
          expect.objectContaining({ rank: 1 }),
        ]),
      }),
    );
  });

  it("still persists a set when LLM returns empty (deterministic-only fallback)", async () => {
    // The OpenAI mock already returns "[]" (empty array)
    const { default: server } = await import("./index.js");
    const res = await server.fetch(
      new Request("http://localhost/", {
        method:  "POST",
        headers: { ...AUTH, "Content-Type": "application/json" },
        body:    JSON.stringify(validBody()),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        strategySnapshot: expect.objectContaining({ isFallback: true }),
      }),
    );
  });

  it("forwards agentJobId from hermesCorrelation when X-Job-Id header is present", async () => {
    const { default: server } = await import("./index.js");
    const res = await server.fetch(
      new Request("http://localhost/", {
        method:  "POST",
        headers: {
          ...AUTH,
          "Content-Type": "application/json",
          "X-Job-Id":     "job-hermes-123",
        },
        body: JSON.stringify(validBody()),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ agentJobId: "job-hermes-123" }),
    );
  });

  it("returns 400 when input is missing tickerId", async () => {
    const { default: server } = await import("./index.js");
    const res = await server.fetch(
      new Request("http://localhost/", {
        method:  "POST",
        headers: { ...AUTH, "Content-Type": "application/json" },
        body:    JSON.stringify({ input: {}, config: makeConfig() }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
