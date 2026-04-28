/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createDashboardAgentDataApiClient } from "./agent-data-api-client";

vi.mock("@hermes/env", () => ({
  env: {
    AGENT_DATA_API_URL: "http://test-agent-data-api",
    HERMES_INTERNAL_API_KEY: "test-api-key",
  },
}));

describe("createDashboardAgentDataApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates client with env defaults for baseUrl and token", () => {
    // Act
    const client = createDashboardAgentDataApiClient();

    // Assert
    expect(client).toBeDefined();
    expect(client.contentGenerationRuns).toBeDefined();
  });

  it("passes custom baseUrl and token when provided", () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ data: [] }),
      statusCode: 200,
    });

    // Act
    const client = createDashboardAgentDataApiClient({
      baseUrl: "http://custom-api",
      token: "custom-token",
      getFn,
    });

    // Assert — verify the custom baseUrl and token are used by making a call
    void client.contentGenerationRuns.get({ limit: 1 });
    expect(getFn).toHaveBeenCalledWith(
      expect.stringContaining("http://custom-api"),
      expect.objectContaining({
        headers: { Authorization: "custom-token" },
      }),
    );
  });

  it("passes custom getFn and postFn for dependency injection", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ data: [] }),
      statusCode: 200,
    });
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ id: "1" }),
      statusCode: 200,
    });

    // Act
    const client = createDashboardAgentDataApiClient({ getFn, postFn });
    await client.contentGenerationRuns.get({ limit: 1 });

    // Assert
    expect(getFn).toHaveBeenCalled();
  });

  it("falls back to empty baseUrl when AGENT_DATA_API_URL is not set", () => {
    // Setup
    vi.doMock("@hermes/env", () => ({
      env: {
        AGENT_DATA_API_URL: undefined,
        HERMES_INTERNAL_API_KEY: "test-api-key",
      },
    }));

    // Act & Assert — should not throw
    const client = createDashboardAgentDataApiClient();
    expect(client).toBeDefined();
  });
});

describe("getDashboardAgentDataApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Reset the singleton between tests
    vi.resetModules();
  });

  it("returns same instance on repeated calls", async () => {
    // Act
    const { getDashboardAgentDataApiClient: getFresh } =
      await import("./agent-data-api-client");
    const client1 = getFresh();
    const client2 = getFresh();

    // Assert
    expect(client1).toBe(client2);
  });
});
