/** @vitest-environment node */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";

import type { HermesHttpClient } from "./http-client.js";
import {
  handleHermesReadToolCall,
  registerHermesTools,
} from "./register-hermes-tools.js";
import { HERMES_READ_TOOL_SPECS } from "./tool-catalog.js";

const findSpec = (name: string) => {
  const spec = HERMES_READ_TOOL_SPECS.find((entry) => entry.name === name);
  if (!spec) {
    throw new Error(`missing spec ${name}`);
  }

  return spec;
};

const readText = (result: CallToolResult): string => {
  const content = result.content[0];
  if (content?.type !== "text") {
    throw new Error("expected text content");
  }

  return content.text;
};

const connectProfileTools = async (onActiveProfileChange: () => void) => {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const setActiveProfileOverride = vi.fn();
  registerHermesTools({
    server,
    httpClient: { request: vi.fn() },
    listProfileSummary: () => ({
      profiles: ["PROD", "STAGING"],
      active: "PROD",
    }),
    setActiveProfileOverride,
    getActiveProfile: () => ({
      profile: {
        name: "STAGING",
        baseUrl: "https://staging.example.com",
        apiKey: "staging-key",
      },
    }),
    onActiveProfileChange,
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, setActiveProfileOverride };
};

describe("handleHermesReadToolCall", () => {
  it("sends GET tools with path and query parameters", async () => {
    const request = vi.fn<HermesHttpClient["request"]>().mockResolvedValue({
      status: 200,
      body: { id: "row-1" },
      text: "",
    });

    const result = await handleHermesReadToolCall(
      findSpec("hermes_get_domain_row"),
      { integrationId: "acme", resource: "orders", itemId: "row-1" },
      { request },
    );

    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/api/domain-integrations/acme/orders/row-1",
      body: undefined,
      searchParams: undefined,
    });
    expect(readText(result)).toBe('{"id":"row-1"}');
    expect(result.structuredContent).toBeUndefined();
  });

  it("sends POST reads with a JSON body and no query", async () => {
    const request = vi.fn<HermesHttpClient["request"]>().mockResolvedValue({
      status: 200,
      body: { success: true },
      text: "",
    });
    const variableId = "550e8400-e29b-41d4-a716-446655440000";

    await handleHermesReadToolCall(
      findSpec("hermes_get_variable"),
      { id: variableId },
      { request },
    );

    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/dashboard/variables/actions/get",
      body: { id: variableId },
      searchParams: undefined,
    });
  });
});

describe("registerHermesTools profile switching", () => {
  it("switches the profile and notifies the whoami cache", async () => {
    const onActiveProfileChange = vi.fn();
    const { client, setActiveProfileOverride } = await connectProfileTools(
      onActiveProfileChange,
    );

    const result = (await client.callTool({
      name: "hermes_set_active_profile",
      arguments: { profile: "staging" },
    })) as CallToolResult;

    expect(setActiveProfileOverride).toHaveBeenCalledWith("STAGING");
    expect(onActiveProfileChange).toHaveBeenCalledTimes(1);
    expect(readText(result)).toBe(
      '{"active":"STAGING","baseUrl":"https://staging.example.com"}',
    );
  });

  it("rejects unknown profiles without clearing the cache", async () => {
    const onActiveProfileChange = vi.fn();
    const { client, setActiveProfileOverride } = await connectProfileTools(
      onActiveProfileChange,
    );

    const result = (await client.callTool({
      name: "hermes_set_active_profile",
      arguments: { profile: "missing" },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(setActiveProfileOverride).not.toHaveBeenCalled();
    expect(onActiveProfileChange).not.toHaveBeenCalled();
  });
});
