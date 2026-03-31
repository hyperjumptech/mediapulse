/** @vitest-environment node */

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

vi.mock("./utilities/web-search", () => ({
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

vi.mock("./utilities/web-fetch", () => ({
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

describe("data-collection agent (HTTP)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 and a Hermes success envelope when the run succeeds", async () => {
    // Setup
    getMock.mockResolvedValue({
      data: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
    });
    postMock.mockResolvedValue("{}");

    // Act
    const { default: app } = await import("./index");
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

    // Assert
    expect(res.status).toBe(200);
    expect(body.schemaVersion).toBe(1);
    expect(body.status).toBe("success");
  });

  it("returns 400 when required provider config is missing", async () => {
    // Setup
    getMock.mockResolvedValue({
      data: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
    });

    // Act
    const { default: app } = await import("./index");
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

    // Assert
    expect(res.status).toBe(400);
    expect(failureCreateMock).not.toHaveBeenCalled();
    expect(runCreateMock).not.toHaveBeenCalled();
  });
});
