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

  it("builds analysis GET with typed query and auth header", async () => {
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        dataSources: [],
        entityTypes: [],
        relationTypes: [],
        existingEntities: [],
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
    });

    await client.analysis.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
      unanalyzed: true,
    });

    expect(getFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "analysis")}?tickerId=11111111-1111-4111-a111-111111111111&unanalyzed=true`,
      expect.objectContaining({
        headers: { Authorization: "Bearer sdk-token" },
      }),
    );
  });

  it("posts analysis payload and parses response", async () => {
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      postFn,
    });

    const result = await client.analysis.create({
      tickerId: "11111111-1111-4111-a111-111111111111",
      entities: [],
      relations: [],
      articleEntities: [],
      articleRelevances: [],
    });

    expect(postFn).toHaveBeenCalledWith(
      `http://agent-data-api${agentDataApiPathname(AGENT_DATA_API_DEFAULT_VERSION, "analysis")}`,
      expect.objectContaining({
        json: {
          tickerId: "11111111-1111-4111-a111-111111111111",
          entities: [],
          relations: [],
          articleEntities: [],
          articleRelevances: [],
        },
      }),
    );
    expect(result.entitiesCreated).toBe(0);
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
        },
        topEntities: [],
        recentThemes: [],
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
          source: "deterministic",
          intent: "breaking",
          rank: 1,
        },
      ],
    });

    // Assert
    expect(getResponse.ticker.symbol).toBe("AAPL");
    expect(postResponse.created).toBe(1);
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

  it("builds API pathnames from manifest resource keys", () => {
    // Act
    const pathname = agentDataApiPathname("v1", "contentGeneration");

    // Assert
    expect(pathname).toBe("/api/v1/content-generation");
  });
});
