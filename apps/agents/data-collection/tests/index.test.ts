import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const AUTH_HEADERS = { Authorization: "Bearer test-token" };

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@workspace/env/agents-data-collection", () => ({
  env: {
    JINA_API_KEY: "jina-key",
    SERPER_API_KEY: "serper-key",
    AGENT_DATA_API_URL: "http://agent-data-api",
    AGENT_AUTH_API_URL: "http://agent-auth-api",
  },
}));

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock("@workspace/agent-runtime", async () => {
  const actual = await vi.importActual<
    typeof import("@workspace/agent-runtime")
  >("@workspace/agent-runtime");

  return {
    ...actual,
    dataApiGet: getMock,
    dataApiPost: postMock,
  };
});

vi.mock("../src/utilities/web-search.js", () => ({
  performWebSearch: vi.fn().mockResolvedValue([
    {
      url: "http://example.com",
      title: "Test",
      content: "Snippet",
      tickerId: TICKER_ID,
      searchQueryId: "sq-1",
      searchQueryText: "test query",
    },
  ]),
}));

vi.mock("../src/utilities/web-fetch.js", () => ({
  performWebFetch: vi.fn().mockResolvedValue([
    {
      url: "http://example.com",
      title: "Test",
      content: "Main content",
      tickerId: TICKER_ID,
      searchQueryId: "sq-1",
      searchQueryText: "test query",
    },
  ]),
}));

describe("data-collection-agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 and success when data collection is successful", async () => {
    getMock.mockResolvedValue({
      searchQueries: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
    });
    postMock.mockResolvedValue("{}");

    const { default: app } = await import("../src/index.js");

    const res = await app.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: TICKER_ID },
          config: {
            webSearch: {
              baseUrl: "https://search.example",
              authentication: { type: "bearer" },
              rateLimit: { requests: 1, perSeconds: 1 },
            },
            webFetch: {
              baseUrl: "https://fetch.example",
              authentication: { type: "bearer" },
              rateLimit: { requests: 1, perSeconds: 1 },
            },
          },
        }),
      }),
    );

    const body = (await res.json()) as { agentId: string };

    expect(res.status).toBe(200);
    expect(body.agentId).toBe("data-collection");
    expect(getMock).toHaveBeenCalled();
    expect(postMock).toHaveBeenCalled();
  });

  it("returns 500 when API keys are missing", async () => {
    const { env } = await import("@workspace/env/agents-data-collection");
    const originalJina = env.JINA_API_KEY;

    (env as any).JINA_API_KEY = "";

    const { default: app } = await import("../src/index.js");

    const res = await app.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: TICKER_ID },
          config: {
            webSearch: {
              baseUrl: "https://search.example",
              authentication: { type: "bearer" },
              rateLimit: { requests: 1, perSeconds: 1 },
            },
            webFetch: {
              baseUrl: "https://fetch.example",
              authentication: { type: "bearer" },
              rateLimit: { requests: 1, perSeconds: 1 },
            },
          },
        }),
      }),
    );

    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(500);
    expect(body.message).toContain("JINA_API_KEY is not configured");

    (env as any).JINA_API_KEY = originalJina;
  });
});
