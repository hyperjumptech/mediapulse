import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const AUTH_HEADERS = { Authorization: "Bearer test-token" };

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mediapulse/env/agents-data-collection", () => ({
  env: {
    JINA_API_KEY: "jina-key",
    SERPER_API_KEY: "serper-key",
    AGENT_DATA_API_URL: "http://agent-data-api",
    AGENT_AUTH_API_URL: "http://agent-auth-api",
  },
}));

const getMock = vi.fn();
const postMock = vi.fn();
const runCreateMock = vi.fn();
const failureCreateMock = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => {
  return {
    createAgentDataApiClient: vi.fn(() => ({
      dataCollection: {
        get: getMock,
        create: postMock,
      },
      dataCollectionRun: {
        create: runCreateMock,
      },
      dataCollectionFailure: {
        create: failureCreateMock,
      },
    })),
  };
});

vi.mock("../src/utilities/web-search.js", () => ({
  performWebSearch: vi.fn().mockResolvedValue([
    {
      success: true,
      data: {
        url: "http://example.com",
        title: "Test",
        content: "Snippet",
        tickerId: TICKER_ID,
        searchQueryId: "sq-1",
        searchQueryText: "test query",
      },
    },
  ]),
}));

vi.mock("../src/utilities/web-fetch.js", () => ({
  performWebFetch: vi.fn().mockResolvedValue([
    {
      success: true,
      data: {
        url: "http://example.com",
        title: "Test",
        content: "Main content",
        tickerId: TICKER_ID,
        searchQueryId: "sq-1",
        searchQueryText: "test query",
      },
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
      data: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
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

    const body = (await res.json()) as {
      schemaVersion: number;
      status: string;
    };

    expect(res.status).toBe(200);
    expect(body.schemaVersion).toBe(1);
    expect(body.status).toBe("success");
    expect(getMock).toHaveBeenCalled();
    expect(postMock).toHaveBeenCalled();
    expect(runCreateMock).toHaveBeenCalled();
  });

  it("returns 400 when required provider config is missing", async () => {
    getMock.mockResolvedValue({
      data: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
    });

    const { default: app } = await import("../src/index.js");

    const res = await app.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: TICKER_ID },
          config: {
            runPolicy: {
              minSuccessfulSources: 1,
              failOnZeroSuccess: true,
            },
          },
        }),
      }),
    );

    expect(res.status).toBe(400);
    expect(failureCreateMock).not.toHaveBeenCalled();
    expect(runCreateMock).not.toHaveBeenCalled();
  });

  it("reports partial success when web-fetch fails for some results", async () => {
    const { performWebFetch } = await import("../src/utilities/web-fetch.js");
    vi.mocked(performWebFetch).mockResolvedValueOnce([
      {
        success: false,
        url: "http://failed.com",
        queryId: "sq-1",
        tickerId: TICKER_ID,
        errorCategory: "provider_http_error",
        message: "404 Not Found",
        retryable: false,
        httpStatus: 404,
      },
    ]);

    getMock.mockResolvedValue({
      data: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
    });

    const { default: app } = await import("../src/index.js");

    const res = await app.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: TICKER_ID },
          config: {
            runPolicy: {
              minSuccessfulSources: 0,
              failOnZeroSuccess: false,
            },
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

    const body = (await res.json()) as any;

    expect(body.details.summary.status).toBe("partial_success");
    expect(failureCreateMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "web-fetch",
          errorCategory: "provider_http_error",
          httpStatus: 404,
        }),
      ]),
    );
    expect(runCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "partial_success",
      }),
    );
  });

  it("fails the run if minSuccessfulSources policy is not met", async () => {
    const { performWebSearch } = await import("../src/utilities/web-search.js");
    const { performWebFetch } = await import("../src/utilities/web-fetch.js");

    // Simulate zero successes
    vi.mocked(performWebSearch).mockResolvedValueOnce([]);
    vi.mocked(performWebFetch).mockResolvedValueOnce([]);

    getMock.mockResolvedValue({
      data: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
    });

    const { default: app } = await import("../src/index.js");

    const res = await app.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: TICKER_ID },
          config: {
            runPolicy: {
              minSuccessfulSources: 1,
              failOnZeroSuccess: true,
            },
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

    expect(res.status).toBe(500);
    expect(runCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
      }),
    );
  });
});
