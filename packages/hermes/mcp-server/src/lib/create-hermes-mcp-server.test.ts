/** @vitest-environment node */
import { readFileSync } from "node:fs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHermesMcpServer } from "./create-hermes-mcp-server.js";
import { createWhoamiCache } from "./mutation-access.js";
import {
  resetActiveProfileOverride,
  type HermesMcpProfile,
} from "./profiles.js";

const productionProfile: HermesMcpProfile = {
  name: "PROD",
  baseUrl: "https://hermes.example.com",
  apiKey: "test-key",
};

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const connectClient = async (
  fetchImpl: typeof fetch,
  whoamiCache = createWhoamiCache(),
) => {
  const server = createHermesMcpServer({
    getActiveProfile: () => ({ profile: productionProfile }),
    fetchImpl,
    whoamiCache,
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, server, whoamiCache };
};

const readText = (result: CallToolResult): string => {
  const content = result.content[0];
  if (content?.type !== "text") {
    throw new Error("expected text content");
  }

  return content.text;
};

const requestedUrls = (fetchImpl: ReturnType<typeof vi.fn>): string[] =>
  fetchImpl.mock.calls.map(([url]) => String(url));

describe("createHermesMcpServer", () => {
  afterEach(() => {
    resetActiveProfileOverride();
  });

  it("reports the package.json version", async () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    const { client } = await connectClient(vi.fn());

    const serverVersion = client.getServerVersion();

    expect(serverVersion).toEqual({
      name: "hermes-mcp",
      version: packageJson.version,
    });
  });

  it("lists every tool with a title, annotations, and list output schemas", async () => {
    const { client } = await connectClient(vi.fn());

    const { tools } = await client.listTools();

    const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.annotations, tool.name).toBeDefined();
    }
    expect(toolsByName.get("hermes_list_agents")?.annotations).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
    });
    expect(
      toolsByName.get("hermes_list_agents")?.outputSchema?.properties,
    ).toHaveProperty("hasMore");
    expect(
      toolsByName.get("hermes_get_pipeline")?.outputSchema,
    ).toBeUndefined();
    expect(
      toolsByName.get("hermes_mutate_delete_agent")?.annotations,
    ).toMatchObject({ destructiveHint: true, idempotentHint: true });
    expect(toolsByName.has("hermes_search")).toBe(true);
    expect(toolsByName.has("hermes_list_domain_rows")).toBe(true);
  });

  it("sends list query keys and returns structured content", async () => {
    const listBody = {
      items: [{ id: "a1" }],
      total: 30,
      page: 2,
      pageSize: 10,
      hasMore: true,
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, listBody));
    const { client } = await connectClient(fetchImpl);

    const result = (await client.callTool({
      name: "hermes_list_agents",
      arguments: {
        page: 2,
        pageSize: 10,
        q: "summar",
        sort: "updated",
        dir: "desc",
      },
    })) as CallToolResult;

    expect(requestedUrls(fetchImpl)).toEqual([
      "https://hermes.example.com/api/agents?page=2&pageSize=10&q=summar&sort=updated&dir=desc",
    ]);
    expect(result.structuredContent).toEqual(listBody);
    expect(readText(result)).toBe(JSON.stringify(listBody));
  });

  it("forwards domain row filters as query parameters", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      }),
    );
    const { client } = await connectClient(fetchImpl);

    await client.callTool({
      name: "hermes_list_domain_rows",
      arguments: {
        integrationId: "acme",
        resource: "orders",
        filters: { status: "open" },
      },
    });

    expect(requestedUrls(fetchImpl)).toEqual([
      "https://hermes.example.com/api/domain-integrations/acme/orders?status=open",
    ]);
  });

  it("calls the dashboard search route for hermes_search", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { results: [] }));
    const { client } = await connectClient(fetchImpl);

    const result = (await client.callTool({
      name: "hermes_search",
      arguments: { q: "daily" },
    })) as CallToolResult;

    expect(requestedUrls(fetchImpl)).toEqual([
      "https://hermes.example.com/api/dashboard-search?q=daily",
    ]);
    expect(readText(result)).toBe('{"results":[]}');
  });

  it("checks whoami once for back-to-back mutations and again after a 401", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/api/mcp/whoami")) {
        return jsonResponse(200, { readOnly: false });
      }
      if (url.endsWith("/api/agents")) {
        return jsonResponse(401, { error: "Unauthorized" });
      }

      return jsonResponse(200, { success: true });
    });
    const { client } = await connectClient(fetchImpl);
    const createVariable = {
      name: "hermes_mutate_create_variable",
      arguments: { key: "A", value: "1" },
    };

    await client.callTool(createVariable);
    await client.callTool(createVariable);
    await client.callTool({ name: "hermes_list_agents", arguments: {} });
    await client.callTool(createVariable);

    const whoamiCalls = requestedUrls(fetchImpl).filter((url) =>
      url.endsWith("/api/mcp/whoami"),
    );
    expect(whoamiCalls).toHaveLength(2);
  });
});
