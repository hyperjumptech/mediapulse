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
});

describe("agent-data-api path helpers", () => {
  it("derives kebab-case path segments from resource keys", () => {
    // Act
    const segment = camelCaseResourceKeyToPathSegment("dataCollection");

    // Assert
    expect(segment).toBe("/data-collection");
  });

  it("builds API pathnames from manifest resource keys", () => {
    // Act
    const pathname = agentDataApiPathname("v1", "contentGeneration");

    // Assert
    expect(pathname).toBe("/api/v1/content-generation");
  });
});
