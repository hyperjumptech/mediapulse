/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const AUTH_HEADERS = { Authorization: "Bearer test-token" };

/** Article-like body that passes the content quality gate. */
const validArticleContent = [
  "Bank Central Asia announced strategic expansion plans across regional markets.",
  "The company reported improved margins, higher loan growth, and stronger risk controls.",
  ...Array.from(
    { length: 90 },
    (_, index) =>
      `Analyst note ${index} discusses lending trends and deposit growth in Indonesia.`,
  ),
].join(" ");

const validArticleTitle = "Bank Central Asia expands regional operations";

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

const { performWebSearchMock, performWebFetchMock } = vi.hoisted(() => ({
  performWebSearchMock: vi.fn(),
  performWebFetchMock: vi.fn(),
}));

const getMock = vi.fn();
const postMock = vi.fn();
const existingUrlsCreateMock = vi.fn();
const runCreateMock = vi.fn();
const failureCreateMock = vi.fn();
const analysisGetMock = vi.fn();
const tickerGetMock = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => {
  return {
    createAgentDataApiClient: vi.fn(() => ({
      dataCollection: {
        get: getMock,
        create: postMock,
      },
      dataCollectionExistingUrls: {
        create: existingUrlsCreateMock,
      },
      dataCollectionDeadUrlsLookup: {
        create: vi.fn().mockResolvedValue({ deadUrls: [] }),
      },
      dataCollectionDeadUrlsRecord: {
        create: vi.fn().mockResolvedValue({
          message: "Dead URLs recorded",
          recordedCount: 0,
        }),
      },
      dataCollectionRecentSourceFingerprints: {
        get: vi.fn().mockResolvedValue({ fingerprints: [] }),
      },
      dataCollectionRun: {
        create: runCreateMock,
      },
      dataCollectionFailure: {
        create: failureCreateMock,
      },
      analysis: {
        get: analysisGetMock,
      },
      ticker: {
        get: tickerGetMock,
      },
    })),
  };
});

vi.mock("./utilities/web-search", () => ({
  performWebSearch: (...args: unknown[]) => performWebSearchMock(...args),
}));

vi.mock("@workspace/agent-ingestion", () => ({
  performWebFetch: (...args: unknown[]) => performWebFetchMock(...args),
}));

const defaultSearchSuccess = [
  {
    success: true,
    data: {
      url: "http://example.com",
      title: validArticleTitle,
      content: "Snippet",
      tickerId: TICKER_ID,
      searchQueryId: "sq-1",
      searchQueryText: "test query",
      serpIndex: 0,
    },
  },
];

const defaultFetchSuccess = [
  {
    success: {
      url: "http://example.com",
      title: validArticleTitle,
      content: validArticleContent,
      tickerId: TICKER_ID,
      searchQueryId: "sq-1",
      searchQueryText: "test query",
      serpIndex: 0,
      provider: "jina" as const,
    },
    failures: [],
  },
];

describe("data-collection agent (HTTP)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    performWebSearchMock.mockResolvedValue(defaultSearchSuccess);
    performWebFetchMock.mockResolvedValue(defaultFetchSuccess);
    existingUrlsCreateMock.mockResolvedValue({
      existingUrls: [],
      hostCounts: {},
    });
    analysisGetMock.mockResolvedValue({
      dataSources: [],
      dataSourceTotalCount: 0,
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
      relevanceSelectionState: {
        utcDayStartIso: "2026-01-01T00:00:00.000Z",
        selectedCountToday: 0,
      },
      lastRelevanceScoredAtIso: null,
    });
    tickerGetMock.mockResolvedValue({
      id: TICKER_ID,
      symbol: "BBCA",
      name: "Bank Central Asia",
      aliases: ["BCA"],
    });
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
          config: {},
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
  }, 15000);

  it("returns 400 when config validation fails", async () => {
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
            collection: {
              targetDailySuccessfulSources: 0,
            },
          },
        }),
      }),
    );

    // Assert
    expect(res.status).toBe(400);
    expect(failureCreateMock).not.toHaveBeenCalled();
    expect(runCreateMock).not.toHaveBeenCalled();
  }, 15000);

  it("returns 200 and a Hermes failure envelope when the run is policy-failed", async () => {
    // Setup
    getMock.mockResolvedValue({
      data: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
    });
    postMock.mockResolvedValue("{}");
    performWebSearchMock.mockResolvedValueOnce([]);
    performWebFetchMock.mockResolvedValueOnce([]);

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

    const body = (await res.json()) as {
      schemaVersion: number;
      status: string;
      message?: string;
    };

    // Assert — semantic failure must not use HTTP 500 so Hermes can surface `message` on the invocation
    expect(res.status).toBe(200);
    expect(body.schemaVersion).toBe(1);
    expect(body.status).toBe("failure");
    expect(body.message).toBe(
      "Data collection run failed: no sources were successfully collected, but the run policy requires at least 1 successful source.",
    );
  }, 15000);
});
