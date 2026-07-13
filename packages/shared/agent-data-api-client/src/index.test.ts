import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_DATA_API_DEFAULT_VERSION,
  agentDataApiPathname,
  camelCaseResourceKeyToPathSegment,
} from "@workspace/agent-data-api-contract";
import { createAgentDataApiClient } from "./index.js";

describe("createAgentDataApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds data-collection GET with typed query and auth header", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        data: [
          {
            id: "11111111-1111-4111-a111-111111111111",
            text: "earnings update",
            tickerId: "11111111-1111-4111-a111-111111111111",
            intent: "breaking",
            rank: 1,
          },
        ],
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
    });

    // Act
    const result = await client.dataCollection.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
    });

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "dataCollection")}?tickerId=11111111-1111-4111-a111-111111111111`,
      expect.objectContaining({
        headers: { Authorization: "Bearer sdk-token" },
      }),
    );
    expect(result.data[0]?.text).toBe("earnings update");
  });

  it("serializes optional query parameters for data-collection GET", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        data: [],
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      getFn,
    });

    // Act
    await client.dataCollection.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
      start: "2026-03-20T00:00:00.000Z",
    });

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "dataCollection")}?tickerId=11111111-1111-4111-a111-111111111111&start=2026-03-20T00%3A00%3A00.000Z`,
      expect.anything(),
    );
  });

  it("posts data-collection-existing-urls payload and parses response", async () => {
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        existingUrls: ["https://exists.example"],
        hostCounts: { "exists.example": 1 },
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      postFn,
    });

    const result = await client.dataCollectionExistingUrls.create({
      tickerId: "11111111-1111-4111-a111-111111111111",
      urls: ["https://exists.example", "https://new.example"],
    });

    expect(postFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "dataCollectionExistingUrls")}`,
      expect.objectContaining({
        json: {
          tickerId: "11111111-1111-4111-a111-111111111111",
          urls: ["https://exists.example", "https://new.example"],
        },
        headers: expect.objectContaining({
          Authorization: "Bearer sdk-token",
        }),
      }),
    );
    expect(result.existingUrls).toEqual(["https://exists.example"]);
  });

  it("posts content-generation payload and parses response", async () => {
    // Setup
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ message: "Success" }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      postFn,
    });

    // Act
    const result = await client.contentGeneration.create({
      subject: "Subject",
      content: "Body",
      tickerId: "11111111-1111-4111-a111-111111111111",
    });

    // Assert
    expect(postFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "contentGeneration")}`,
      expect.objectContaining({
        json: {
          subject: "Subject",
          content: "Body",
          tickerId: "11111111-1111-4111-a111-111111111111",
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sdk-token",
        },
      }),
    );
    expect(result).toEqual({ message: "Success" });
  });

  it("posts content-generation payload with provenance fields", async () => {
    // Setup
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ message: "Success" }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      postFn,
    });

    // Act
    const result = await client.contentGeneration.create({
      subject: "Provenance Subject",
      content: "Provenance body",
      tickerId: "11111111-1111-4111-a111-111111111111",
      model: "gpt-4o",
      agentVersion: "1.2.3",
      configVersion: "hermes-v3",
      promptHash: "abc12345",
      configSnapshotId: "snap-001",
      promptTokens: 512,
      completionTokens: 256,
      totalTokens: 768,
    });

    // Assert
    expect(postFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "contentGeneration")}`,
      expect.objectContaining({
        json: {
          subject: "Provenance Subject",
          content: "Provenance body",
          tickerId: "11111111-1111-4111-a111-111111111111",
          model: "gpt-4o",
          agentVersion: "1.2.3",
          configVersion: "hermes-v3",
          promptHash: "abc12345",
          configSnapshotId: "snap-001",
          promptTokens: 512,
          completionTokens: 256,
          totalTokens: 768,
        },
      }),
    );
    expect(result).toEqual({ message: "Success" });
  });

  it("throws for non-2xx responses", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ message: "error" }),
      statusCode: 404,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      getFn,
    });

    // Act
    const act = () =>
      client.delivery.get({ tickerId: "11111111-1111-4111-a111-111111111111" });

    // Assert
    await expect(act).rejects.toThrow("Agent data API error: 404");
  });

  it("includes compact response body in non-2xx error message", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        error: "Unknown entityName for article entity: BCA",
      }),
      statusCode: 400,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      getFn,
    });

    // Act
    const act = () =>
      client.delivery.get({ tickerId: "11111111-1111-4111-a111-111111111111" });

    // Assert
    await expect(act).rejects.toThrow(
      'Agent data API error: 400 - {"error":"Unknown entityName for article entity: BCA"}',
    );
  });

  it("builds analysis GET with typed query and auth header", async () => {
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        dataSources: [
          {
            id: "33333333-3333-4333-a333-333333333333",
            tickerId: "44444444-4444-4444-8444-444444444444",
            url: "https://example.com",
            title: "Example",
            description: "Snippet",
            content: "Body",
            createdAt: "2026-03-19T00:00:00.000Z",
            ticker: {
              symbol: "AGRO",
              name: "PT Bank Raya Indonesia Tbk",
              sector: "Keuangan",
              industry: "Bank",
              subIndustry: "Bank",
              businessActivity: "Perbankan",
            },
          },
        ],
        dataSourceTotalCount: 1,
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
    });

    const result = await client.analysis.get({
      unanalyzed: true,
      limit: 5,
    });

    expect(result.dataSources[0]?.ticker?.businessActivity).toBe("Perbankan");
    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "analysis")}?unanalyzed=true&limit=5`,
      expect.objectContaining({
        headers: { Authorization: "Bearer sdk-token" },
      }),
    );
  });

  it("posts analysis section payload and parses response", async () => {
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        articlesScored: 1,
        articlesRejected: 0,
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      postFn,
    });

    const result = await client.analysis.create({
      articleSections: [
        {
          dataSourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          tickerId: "44444444-4444-4444-8444-444444444444",
          section: "competitiveLandscape",
          score: 0.7,
          reason: "Mentions a rival.",
        },
      ],
      analyzedDataSourceIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    });

    expect(postFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "analysis")}`,
      expect.objectContaining({
        json: {
          articleSections: [
            {
              dataSourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tickerId: "44444444-4444-4444-8444-444444444444",
              section: "competitiveLandscape",
              score: 0.7,
              reason: "Mentions a rival.",
            },
          ],
          analyzedDataSourceIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        },
      }),
    );
    expect(result.articlesScored).toBe(1);
  });

  it("uses explicit version when provided", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ data: [] }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      version: "v2",
      getFn,
    });

    // Act
    await client.dataCollection.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
    });

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname("v2", "dataCollection")}?tickerId=11111111-1111-4111-a111-111111111111`,
      expect.anything(),
    );
  });

  it("supports query-analysis GET and POST", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        ticker: {
          id: "11111111-1111-4111-a111-111111111111",
          symbol: "AAPL",
          name: "Apple Inc.",
          metadata: null,
          sector: "Technology",
          industry: "Consumer Electronics",
          subSector: null,
          subIndustry: null,
          businessActivity: null,
        },
      }),
      statusCode: 200,
    });
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        created: 1,
        createdSetId: "22222222-2222-4222-a222-222222222222",
        activeSetId: "22222222-2222-4222-a222-222222222222",
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
      postFn,
    });

    // Act
    const getResponse = await client.queryAnalysis.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
    });
    const postResponse = await client.queryAnalysis.create({
      tickerId: "11111111-1111-4111-a111-111111111111",
      generationSource: "hybrid_v1",
      strategySnapshot: { queryCount: 10 },
      activate: true,
      queries: [
        {
          text: "AAPL latest news",
          intent: "breaking",
          rank: 1,
        },
      ],
    });

    // Assert
    expect(getResponse.ticker.symbol).toBe("AAPL");
    expect(getResponse.ticker.sector).toBe("Technology");
    expect(getResponse.ticker.industry).toBe("Consumer Electronics");
    expect(postResponse.created).toBe(1);
  });

  it("supports content-generation-newsletters-latest GET", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        hasNewsletter: true,
        newsletterId: "nl-456",
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
    });

    // Act
    const result = await client.contentGenerationNewslettersLatest.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
      windowStart: "2026-04-20T00:00:00.000Z",
      windowEnd: "2026-04-21T00:00:00.000Z",
    });

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "contentGenerationNewslettersLatest")}?tickerId=11111111-1111-4111-a111-111111111111&windowStart=2026-04-20T00%3A00%3A00.000Z&windowEnd=2026-04-21T00%3A00%3A00.000Z`,
      expect.objectContaining({
        headers: { Authorization: "Bearer sdk-token" },
      }),
    );
    expect(result.hasNewsletter).toBe(true);
    expect(result.newsletterId).toBe("nl-456");
  });

  it("supports content-generation-newsletters-recent GET", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        items: [
          {
            subject: "BCA profit up 12%",
            createdAt: "2026-04-20T12:00:00.000Z",
          },
        ],
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
    });

    // Act
    const result = await client.contentGenerationNewslettersRecent.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
      days: 7,
    });

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "contentGenerationNewslettersRecent")}?tickerId=11111111-1111-4111-a111-111111111111&days=7`,
      expect.objectContaining({
        headers: { Authorization: "Bearer sdk-token" },
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.subject).toBe("BCA profit up 12%");
  });

  it("supports content-generation-bullets-recent GET", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        items: [
          {
            newsletterId: "nl-1",
            sectionKey: "quickHits",
            bulletText: "BCA profit up 12%",
            createdAt: "2026-04-20T12:00:00.000Z",
          },
        ],
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
    });

    // Act
    const result = await client.contentGenerationBulletsRecent.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
      days: 14,
    });

    // Assert
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.bulletText).toBe("BCA profit up 12%");
  });

  it("builds contentGenerationRuns GET with typed query", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ data: [] }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
    });

    // Act
    const result = await client.contentGenerationRuns.get({
      cursor: "00000000-0000-0000-0000-000000000000",
      limit: 10,
      tickerId: "11111111-1111-4111-a111-111111111111",
      outcome: "failed",
    });

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "contentGenerationRuns")}?cursor=00000000-0000-0000-0000-000000000000&limit=10&tickerId=11111111-1111-4111-a111-111111111111&outcome=failed`,
      expect.objectContaining({
        headers: { Authorization: "Bearer sdk-token" },
      }),
    );
    expect(result.data).toEqual([]);
  });

  it("accepts non-UUID tickerId for contentGenerationRuns GET", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ data: [] }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
    });

    // Act
    await client.contentGenerationRuns.get({
      tickerId: "ticker-bca",
    });

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "contentGenerationRuns")}?tickerId=ticker-bca`,
      expect.objectContaining({
        headers: { Authorization: "Bearer sdk-token" },
      }),
    );
  });

  it("builds contentGenerationRuns POST with typed body and returns created record", async () => {
    // Setup
    const now = "2026-04-14T00:00:00.000Z";
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        id: "33333333-3333-4333-a333-333333333333",
        agentId: "content-generation",
        agentVersion: "1.0.0",
        tickerId: "11111111-1111-4111-a111-111111111111",
        outcome: "success",
        stage: null,
        errorCode: null,
        errorCategory: null,
        message: null,
        durationMs: 1200,
        pipelineRunId: null,
        newsletterId: "22222222-2222-4222-a222-222222222222",
        createdAt: now,
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      postFn,
    });

    // Act
    const result = await client.contentGenerationRuns.create({
      agentId: "content-generation",
      agentVersion: "1.0.0",
      tickerId: "11111111-1111-4111-a111-111111111111",
      outcome: "success",
      durationMs: 1200,
      newsletterId: "22222222-2222-4222-a222-222222222222",
    });

    // Assert
    expect(postFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "contentGenerationRuns")}`,
      expect.objectContaining({
        json: expect.objectContaining({
          agentId: "content-generation",
          outcome: "success",
        }),
      }),
    );
    expect(result.id).toBe("33333333-3333-4333-a333-333333333333");
    expect(result.createdAt).toBe(now);
  });

  it("accepts non-UUID tickerId for contentGenerationRuns POST", async () => {
    // Setup
    const now = "2026-04-14T00:00:00.000Z";
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        id: "33333333-3333-4333-a333-333333333333",
        agentId: "content-generation",
        agentVersion: "1.0.0",
        tickerId: "ticker-bca",
        outcome: "success",
        stage: null,
        errorCode: null,
        errorCategory: null,
        message: null,
        durationMs: 1200,
        pipelineRunId: null,
        newsletterId: null,
        createdAt: now,
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      postFn,
    });

    // Act
    const result = await client.contentGenerationRuns.create({
      agentId: "content-generation",
      agentVersion: "1.0.0",
      tickerId: "ticker-bca",
      outcome: "success",
      durationMs: 1200,
      newsletterId: null,
    });

    // Assert
    expect(postFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "contentGenerationRuns")}`,
      expect.objectContaining({
        json: expect.objectContaining({
          tickerId: "ticker-bca",
        }),
      }),
    );
    expect(result.tickerId).toBe("ticker-bca");
  });

  it("builds userRegistrationTickers GET without query string or auth header", async () => {
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        tickers: [{ symbol: "BBCA", name: "Bank Central Asia Tbk" }],
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      getFn,
    });

    const result = await client.userRegistrationTickers.get({});

    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "userRegistrationTickers")}`,
      expect.objectContaining({
        headers: undefined,
      }),
    );
    expect(result.tickers).toHaveLength(1);
    expect(result.tickers[0]?.symbol).toBe("BBCA");
  });
});

describe("agent-data-api path helpers", () => {
  it("derives kebab-case path segments from resource keys", () => {
    // Act
    const segment = camelCaseResourceKeyToPathSegment("dataCollection");

    // Assert
    expect(segment).toBe("/data-collection");
  });

  it("maps analysis resource key to path segment", () => {
    expect(camelCaseResourceKeyToPathSegment("analysis")).toBe("/analysis");
  });

  it("maps userRegistrationTickers resource key to path segment", () => {
    expect(camelCaseResourceKeyToPathSegment("userRegistrationTickers")).toBe(
      "/user-registration-tickers",
    );
  });

  it("builds API pathnames from manifest resource keys", () => {
    // Act
    const pathname = agentDataApiPathname("v1", "contentGeneration");

    // Assert
    expect(pathname).toBe("/api/v1/content-generation");
  });

  it("supports ticker GET", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        id: "11111111-1111-4111-a111-111111111111",
        symbol: "BBCA",
        name: "Bank Central Asia Tbk",
        aliases: ["BCA"],
        sector: "Keuangan",
        industry: "Perbankan",
        subSector: "Bank",
        subIndustry: "Bank",
        businessActivity: "Jasa Perbankan",
        peers: [{ symbol: "BBRI", name: "Bank Rakyat Indonesia Tbk" }],
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
    });

    // Act
    const result = await client.ticker.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
    });

    // Assert
    expect(result.symbol).toBe("BBCA");
    expect(result.aliases).toEqual(["BCA"]);
    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "ticker")}?tickerId=11111111-1111-4111-a111-111111111111`,
      expect.anything(),
    );
  });
});
