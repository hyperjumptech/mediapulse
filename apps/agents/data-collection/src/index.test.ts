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

vi.mock("got", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn().mockReturnValue({
      json: vi.fn(),
    }),
  },
}));

const getGot = async () => (await import("got")).default;

describe("data-collection-agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 and success when data collection is successful", async () => {
    const got = await getGot();
    (got.get as any).mockResolvedValue({
      body: JSON.stringify({
        searchQueries: [
          { id: "sq-1", text: "test query", tickerId: TICKER_ID },
        ],
      }),
    });

    const mockPost = got.post as any;
    mockPost.mockImplementation((url: string) => {
      if (url === "https://google.serper.dev/search") {
        return {
          json: vi.fn().mockResolvedValue({
            organic: [
              { link: "http://example.com", title: "Test", snippet: "Snippet" },
            ],
          }),
        };
      }
      if (url === "https://r.jina.ai/") {
        return {
          json: vi.fn().mockResolvedValue({
            data: {
              url: "http://example.com",
              title: "Test",
              content: "Main content",
            },
          }),
        };
      }
      return { statusCode: 200 };
    });

    const { default: app } = await import("./index.js");
    const res = await app.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ tickerId: TICKER_ID }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.agentId).toBe("data-collection");
    expect(got.get).toHaveBeenCalled();
    expect(got.post).toHaveBeenCalled();
  });

  it("returns 500 when API keys are missing", async () => {
    const { env } = await import("@workspace/env/agents-data-collection");
    const originalJina = env.JINA_API_KEY;
    (env as any).JINA_API_KEY = "";

    const { default: app } = await import("./index.js");
    const res = await app.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ tickerId: TICKER_ID }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.message).toContain("JINA_API_KEY is not configured");

    (env as any).JINA_API_KEY = originalJina;
  });
});
