import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentDataApiClient } from "./index.js";

describe("createAgentDataApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds query-analysis GET with typed query and auth header", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        ticker: {
          id: "11111111-1111-4111-a111-111111111111",
          symbol: "BBRI",
          name: "Bank Rakyat Indonesia",
          metadata: null,
        },
        topEntities: [],
        recentThemes: [],
      }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      getFn,
    });

    // Act
    const result = await client.queryAnalysis.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
    });

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      "http://agent-data-api/api/query-analysis?tickerId=11111111-1111-4111-a111-111111111111",
      expect.objectContaining({
        headers: { Authorization: "Bearer sdk-token" },
      }),
    );
    expect(result.ticker.symbol).toBe("BBRI");
  });

  it("serializes boolean query parameters for analysis GET", async () => {
    // Setup
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
      getFn,
    });

    // Act
    await client.analysis.get({
      tickerId: "11111111-1111-4111-a111-111111111111",
      unanalyzed: true,
    });

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      "http://agent-data-api/api/analysis?tickerId=11111111-1111-4111-a111-111111111111&unanalyzed=true",
      expect.anything(),
    );
  });

  it("posts query-analysis payload and parses response", async () => {
    // Setup
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ created: 8 }),
      statusCode: 200,
    });
    const client = createAgentDataApiClient({
      baseUrl: "http://agent-data-api",
      token: "Bearer sdk-token",
      postFn,
    });

    // Act
    const result = await client.queryAnalysis.create({
      tickerId: "11111111-1111-4111-a111-111111111111",
      queries: [{ text: "BBRI quarterly earnings" }],
    });

    // Assert
    expect(postFn).toHaveBeenCalledWith(
      "http://agent-data-api/api/query-analysis",
      expect.objectContaining({
        json: {
          tickerId: "11111111-1111-4111-a111-111111111111",
          queries: [{ text: "BBRI quarterly earnings" }],
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sdk-token",
        },
      }),
    );
    expect(result).toEqual({ created: 8 });
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
});
