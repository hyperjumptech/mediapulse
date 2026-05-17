import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createHermesHttpClient } from "./http-client.js";
import { getActiveProfile } from "./profiles.js";
import { registerHermesMutateTools } from "./register-hermes-mutate-tools.js";
import { registerHermesTools } from "./register-hermes-tools.js";

export type CreateHermesMcpServerDependencies = {
  getActiveProfile?: typeof getActiveProfile;
  fetchImpl?: typeof fetch;
};

/**
 * Creates an MCP server with Hermes read tools and profile helpers registered.
 *
 * @param dependencies - Optional profile resolver and fetch for tests.
 * @returns Configured {@link McpServer}.
 */
export const createHermesMcpServer = (
  dependencies: CreateHermesMcpServerDependencies = {},
): McpServer => {
  const getActiveProfileFn = dependencies.getActiveProfile ?? getActiveProfile;

  const server = new McpServer(
    {
      name: "hermes-mcp",
      version: "0.0.1",
    },
    {
      instructions:
        "Hermes dashboard MCP tools. Use hermes_ping to verify the API key. Use hermes_list_* / hermes_get_* for reads. Mutation tools are prefixed hermes_mutate_*; destructive tools require confirm: true on a second call. Switch environments with hermes_set_active_profile when multiple profiles are configured.",
    },
  );

  const httpClient = createHermesHttpClient({
    getProfile: () => getActiveProfileFn(),
    fetchImpl: dependencies.fetchImpl,
  });

  registerHermesTools({
    server,
    httpClient,
    getActiveProfile: getActiveProfileFn,
  });

  registerHermesMutateTools({
    server,
    httpClient,
  });

  return server;
};
