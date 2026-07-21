/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunContext } from "@workspace/agent-runtime";

import type { BodySchemaType } from "./utilities/body-schema";
import { ConfigSchema, type ConfigSchemaType } from "./utilities/config-schema";

const SOURCE_URL = "https://example.com/article-one";

const baseConfig = ConfigSchema.parse({});

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
const runCreateMock = vi.fn();
const outcomeCreateMock = vi.fn();
const pageRunCreateMock = vi.fn();
const tickerRelevanceTermsGetMock = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    pageCollection: { create: pageCollectionCreateMock },
    pageCollectionExistingUrls: { create: existingUrlsCreateMock },
    pageCollectionResolveSources: { create: resolveSourcesCreateMock },
    dataCollectionDeadUrlsLookup: { create: deadUrlsLookupMock },
    dataCollectionRun: { create: runCreateMock },
    collectionUrlOutcome: { create: outcomeCreateMock },
    pageCollectionRun: { create: pageRunCreateMock },
    tickerRelevanceTerms: { get: tickerRelevanceTermsGetMock },
  })),
}));

vi.mock("./utilities/expand-source-urls", () => ({
  expandSourceUrl: vi.fn(async (url: string) => [
    {
      url,
      title: "BBCA article title",
      summary: "BBCA membukukan laba bersih kuartal III yang naik 12 persen",
    },
  ]),
}));

import { expandSourceUrl } from "./utilities/expand-source-urls";
import { runPageCollection } from "./run";

/** Builds a minimal run context for page-collection tests. */
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

    vi.mocked(expandSourceUrl).mockResolvedValue([
      {
        url: SOURCE_URL,
        title: "BBCA article title",
        summary: "BBCA membukukan laba bersih kuartal III yang naik 12 persen",
      },
    ]);

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

    pageCollectionCreateMock.mockResolvedValue({
      message: "Success",
      persistedCount: 1,
    });
    existingUrlsCreateMock.mockResolvedValue({ existingUrls: [] });
    deadUrlsLookupMock.mockResolvedValue({ deadUrls: [] });
    runCreateMock.mockResolvedValue({});
    outcomeCreateMock.mockResolvedValue({ message: "Success" });
    pageRunCreateMock.mockResolvedValue({});
    tickerRelevanceTermsGetMock.mockResolvedValue({
      tickers: [
        {
          id: "44444444-4444-4444-a444-444444444444",
          symbol: "BBCA",
          terms: ["BBCA", "Bank Central Asia"],
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists the discovered feed description as the source description with no fetch", async () => {
    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(pageCollectionCreateMock).toHaveBeenCalledOnce();

    const persistedSource = pageCollectionCreateMock.mock.calls[0]![0][0];

    expect(persistedSource.curatedSourceListingUrl).toBe(SOURCE_URL);
    expect(persistedSource.collectionGateStatus).toBe("passed");
    expect(persistedSource.url).toBe(SOURCE_URL);
    expect(persistedSource.title).toBe("BBCA article title");
    expect(persistedSource.description).toBe(
      "BBCA membukukan laba bersih kuartal III yang naik 12 persen",
    );
    expect(persistedSource).not.toHaveProperty("content");
  });

  it("drops articles that discovery yields no description for", async () => {
    vi.mocked(expandSourceUrl).mockResolvedValue([{ url: SOURCE_URL }]);

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(pageCollectionCreateMock).not.toHaveBeenCalled();
    expect(result.details?.summary).toEqual(
      expect.objectContaining({ droppedByMissingDescription: 1 }),
    );
    expect(outcomeCreateMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          status: "dropped",
          reason: "empty_description",
        }),
      ]),
    );
  });

  it("records a global DataCollectionRun without tickerId", async () => {
    await runPageCollection(createContext());

    expect(runCreateMock).toHaveBeenCalledOnce();
    const runPayload = runCreateMock.mock.calls[0]![0];

    expect(runPayload.tickerId).toBeUndefined();
    expect(runPayload.status).toBe("success");
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
      {
        url: existingUrl,
        summary: "BBCA existing article summary with enough descriptive text",
      },
      {
        url: newUrl,
        summary: "BBCA new article summary with enough descriptive text here",
      },
      {
        url: newUrl,
        summary: "BBCA new article summary with enough descriptive text here",
      },
    ]);

    existingUrlsCreateMock.mockResolvedValue({ existingUrls: [existingUrl] });

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(result.details?.summary).toEqual(
      expect.objectContaining({
        discoveredCount: 3,
        droppedByExistingCanonicalUrl: 1,
        droppedByDuplicateCanonicalUrl: 1,
        droppedByUrlNoise: 0,
        droppedByRunItemCap: 0,
        droppedByMissingDescription: 0,
        totalSources: 1,
      }),
    );
  });

  it("drops candidates with no tracked-ticker mention and records the outcome", async () => {
    vi.mocked(expandSourceUrl).mockResolvedValue([
      {
        url: SOURCE_URL,
        title: "Unrelated headline",
        summary:
          "Nothing about any tracked company here, just unrelated filler text",
      },
    ]);

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(pageCollectionCreateMock).not.toHaveBeenCalled();
    expect(result.details?.summary).toEqual(
      expect.objectContaining({
        droppedByRelevance: 1,
        relevanceMatchedCount: 0,
      }),
    );
    expect(outcomeCreateMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          status: "dropped",
          reason: "relevance_no_match",
        }),
      ]),
    );
  });

  it("counts matched candidates without dropping them", async () => {
    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(result.details?.summary).toEqual(
      expect.objectContaining({
        droppedByRelevance: 0,
        relevanceMatchedCount: 1,
      }),
    );
  });

  it("fails the run and collects nothing when the terms lookup fails", async () => {
    tickerRelevanceTermsGetMock.mockRejectedValue(new Error("API unavailable"));

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(false);
    expect(pageCollectionCreateMock).not.toHaveBeenCalled();
    expect(runCreateMock.mock.calls[0]![0].status).toBe("failed");
  });

  it("fails the run and collects nothing when no active ticker has terms", async () => {
    tickerRelevanceTermsGetMock.mockResolvedValue({ tickers: [] });

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(false);
    expect(pageCollectionCreateMock).not.toHaveBeenCalled();
    expect(runCreateMock.mock.calls[0]![0].status).toBe("failed");
  });

  it("drops bot interstitial titles before relevance", async () => {
    vi.mocked(expandSourceUrl).mockResolvedValue([
      {
        url: SOURCE_URL,
        title: "Just a moment...",
        summary: "BBCA membukukan laba bersih kuartal III yang naik 12 persen",
      },
    ]);

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(pageCollectionCreateMock).not.toHaveBeenCalled();
    expect(result.details?.summary).toEqual(
      expect.objectContaining({ droppedByJunkTitle: 1 }),
    );
  });

  it("drops descriptions below the minimum length", async () => {
    vi.mocked(expandSourceUrl).mockResolvedValue([
      {
        url: SOURCE_URL,
        title: "BBCA article title",
        summary: "Read more",
      },
    ]);

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(pageCollectionCreateMock).not.toHaveBeenCalled();
    expect(result.details?.summary).toEqual(
      expect.objectContaining({ droppedByShortDescription: 1 }),
    );
  });

  it("records the matched ticker on the collected outcome", async () => {
    await runPageCollection(createContext());

    expect(outcomeCreateMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          status: "collected",
          tickerId: "44444444-4444-4444-a444-444444444444",
        }),
      ]),
    );
  });
});
