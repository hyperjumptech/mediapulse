/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunContext } from "@workspace/agent-runtime";

import type { BodySchemaType } from "./utilities/body-schema";
import { ConfigSchema, type ConfigSchemaType } from "./utilities/config-schema";
import type {
  FetchedWebSearchResult,
  WebFetchOutcome,
} from "@workspace/agent-ingestion";

const SOURCE_URL = "https://example.com/article-one";

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

const baseConfig = ConfigSchema.parse({
  providers: {
    fetch: {
      providers: [
        {
          type: "jina",
          baseUrl: "https://fetch.example",
          authentication: { type: "bearer" },
          rateLimit: { requests: 1, perSeconds: 1 },
          concurrency: 4,
        },
      ],
    },
  },
  runPolicy: {
    minSuccessfulSources: 1,
    failOnZeroSuccess: true,
  },
});

const mockFetchSuccess = (
  data: Omit<FetchedWebSearchResult, "provider"> &
    Partial<Pick<FetchedWebSearchResult, "provider">>,
): WebFetchOutcome => ({
  success: { provider: "jina", ...data },
  failures: [],
});

vi.mock("@mediapulse/env/agents-page-collection", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api",
    AGENT_AUTH_API_URL: "http://agent-auth-api",
    AGENT_REGISTRY_URL: "http://agent-registry",
  },
}));

vi.mock("@workspace/logger", () => ({
  logger: {
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

const pageCollectionCreateMock = vi.fn();
const existingUrlsCreateMock = vi.fn();
const resolveSourcesCreateMock = vi.fn();
const deadUrlsLookupMock = vi.fn();
const deadUrlsRecordMock = vi.fn();
const runCreateMock = vi.fn();
const failureCreateMock = vi.fn();
const outcomeCreateMock = vi.fn();
const pageRunCreateMock = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    pageCollection: { create: pageCollectionCreateMock },
    pageCollectionExistingUrls: { create: existingUrlsCreateMock },
    pageCollectionResolveSources: { create: resolveSourcesCreateMock },
    dataCollectionDeadUrlsLookup: { create: deadUrlsLookupMock },
    dataCollectionDeadUrlsRecord: { create: deadUrlsRecordMock },
    dataCollectionRun: { create: runCreateMock },
    dataCollectionFailure: { create: failureCreateMock },
    collectionUrlOutcome: { create: outcomeCreateMock },
    pageCollectionRun: { create: pageRunCreateMock },
  })),
}));

vi.mock("./utilities/expand-source-urls", () => ({
  expandSourceUrl: vi.fn(async (url: string) => [{ url }]),
  looksLikeSitemapUrl: vi.fn(() => false),
  looksLikeFeedUrl: vi.fn(() => false),
}));

vi.mock("@workspace/agent-ingestion", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/agent-ingestion")>();
  return {
    ...actual,
    performWebFetch: vi.fn(),
  };
});

import { performWebFetch } from "@workspace/agent-ingestion";
import { expandSourceUrl } from "./utilities/expand-source-urls";
import { runPageCollection } from "./run";

/** Builds a minimal run context for page-collection v2 tests. */
function createContext(
  overrides?: Partial<AgentRunContext<BodySchemaType, ConfigSchemaType>>,
): AgentRunContext<BodySchemaType, ConfigSchemaType> {
  return {
    input: { listingUrl: SOURCE_URL },
    config: baseConfig,
    token: "Bearer test-token",
    ...overrides,
  };
}

describe("runPageCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    resolveSourcesCreateMock.mockResolvedValue({
      sources: [
        {
          listingUrl: SOURCE_URL,
          curatedSourceId: "33333333-3333-4333-a333-333333333333",
          linkType: "page",
          maxItems: null,
        },
      ],
    });

    vi.mocked(performWebFetch).mockResolvedValue([
      mockFetchSuccess({
        url: SOURCE_URL,
        title: validArticleTitle,
        content: validArticleContent,
        tickerId: "",
        searchQueryId: "",
        searchQueryText: "",
        serpIndex: 0,
      }),
    ]);

    pageCollectionCreateMock.mockResolvedValue({
      message: "Success",
      persistedCount: 1,
    });
    existingUrlsCreateMock.mockResolvedValue({ existingUrls: [] });
    deadUrlsLookupMock.mockResolvedValue({ deadUrls: [] });
    deadUrlsRecordMock.mockResolvedValue({
      message: "Dead URLs recorded",
      recordedCount: 0,
    });
    runCreateMock.mockResolvedValue({});
    failureCreateMock.mockResolvedValue({});
    outcomeCreateMock.mockResolvedValue({ message: "Success" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists gate-surviving sources without tickerId", async () => {
    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(pageCollectionCreateMock).toHaveBeenCalledOnce();

    const persistedSource = pageCollectionCreateMock.mock.calls[0]![0][0];

    expect(persistedSource.curatedSourceListingUrl).toBe(SOURCE_URL);
    expect(persistedSource.collectionGateStatus).toBe("passed");
    expect(persistedSource.url).toBe(SOURCE_URL);
  });

  it("records a global DataCollectionRun without tickerId", async () => {
    await runPageCollection(createContext());

    expect(runCreateMock).toHaveBeenCalledOnce();
    const runPayload = runCreateMock.mock.calls[0]![0];

    expect(runPayload.tickerId).toBeUndefined();
    expect(runPayload.status).toBe("success");
  });

  it("returns semantic failure with descriptive message when policy is not met", async () => {
    vi.mocked(performWebFetch).mockResolvedValue([
      {
        success: null,
        failures: [
          {
            provider: "jina",
            url: SOURCE_URL,
            errorCategory: "network_error",
            retryable: true,
            message: "timeout",
            queryId: "",
            tickerId: "",
          },
        ],
      },
    ]);

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain(
        "no sources were successfully collected",
      );
    }
    expect(failureCreateMock).toHaveBeenCalledOnce();
    expect(outcomeCreateMock).toHaveBeenCalled();
  });

  it("persists a failed run record when resolve-sources throws", async () => {
    resolveSourcesCreateMock.mockRejectedValue(new Error("API unavailable"));

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(false);
    expect(runCreateMock).toHaveBeenCalledOnce();
    expect(runCreateMock.mock.calls[0]![0].status).toBe("failed");
  });

  it("includes pre-fetch drop counters in the agent response summary", async () => {
    const existingUrl = "https://example.com/existing-article";
    const newUrl = "https://example.com/new-article";

    vi.mocked(expandSourceUrl).mockResolvedValue([
      { url: existingUrl },
      { url: newUrl },
      { url: newUrl },
    ]);

    existingUrlsCreateMock.mockResolvedValue({ existingUrls: [existingUrl] });

    vi.mocked(performWebFetch).mockResolvedValue([
      mockFetchSuccess({
        url: newUrl,
        title: validArticleTitle,
        content: validArticleContent,
        tickerId: "",
        searchQueryId: "",
        searchQueryText: "",
        serpIndex: 0,
      }),
    ]);

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(result.details?.summary).toEqual(
      expect.objectContaining({
        discoveredCount: 3,
        droppedByExistingCanonicalUrl: 1,
        droppedByDuplicateCanonicalUrl: 1,
        droppedByUrlNoise: 0,
        droppedByHostErrorRate: 0,
        droppedByRunItemCap: 0,
        fetchSuccess: 1,
        totalSources: 1,
      }),
    );
  });
});
