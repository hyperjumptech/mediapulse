/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import { createMediapulseAgentDataApiClient } from "./agent-data-api-client";

const testConfig = {
  agentDataApiUrl: "http://test-agent-data-api",
  agentAuthApiUrl: "http://test-agent-auth-api",
  internalApiKey: "test-api-key",
  cgaDiagnosticsEnabled: false,
};

describe("createMediapulseAgentDataApiClient", () => {
  it("creates client with config baseUrl and token", () => {
    const client = createMediapulseAgentDataApiClient(testConfig);

    expect(client).toBeDefined();
    expect(client.contentGenerationRuns).toBeDefined();
  });

  it("passes custom getFn for dependency injection", async () => {
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ data: [] }),
      statusCode: 200,
    });

    const client = createMediapulseAgentDataApiClient(testConfig, { getFn });
    await client.contentGenerationRuns.get({ limit: 1 });

    expect(getFn).toHaveBeenCalledWith(
      expect.stringContaining("http://test-agent-data-api"),
      expect.objectContaining({
        headers: { Authorization: "test-api-key" },
      }),
    );
  });
});
