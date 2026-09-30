import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createHermesHttpClient } from "./http-client.js";
import {
  buildProfileCacheKey,
  createWhoamiCache,
  withWhoamiCacheInvalidation,
  type WhoamiCache,
} from "./mutation-access.js";
import { getActiveProfile } from "./profiles.js";
import { registerHermesMutateTools } from "./register-hermes-mutate-tools.js";
import { registerHermesTools } from "./register-hermes-tools.js";
import { readServerVersion } from "./server-version.js";
import { loadEnabledToolsets, type HermesToolset } from "./toolsets.js";

export const HERMES_MCP_SERVER_INSTRUCTIONS = [
  "Hermes dashboard tools. Call hermes_ping first to verify the API key.",
  "List tools (hermes_list_*) take page and pageSize (max 100), searchable ones also q, sort, and dir. They return items, total, page, pageSize, and hasMore. Request the next page while hasMore is true.",
  "Debug a run with hermes_list_*_executions, then hermes_get_*_execution, then hermes_get_invocation and hermes_get_agent_activities for one invocation.",
  "Use hermes_search to turn a name into an id, then a hermes_get_* tool for full detail.",
  "Domain data: hermes_list_domain_views, then hermes_list_domain_rows and hermes_get_domain_row. hermes_get_domain_view has a view's create and update schemas, which hermes_mutate_create_domain_row and hermes_mutate_update_domain_row expect. hermes_get_domain_content renders content views.",
  "Build a pipeline with hermes_mutate_create_pipeline, then hermes_mutate_add_agent_step or hermes_mutate_add_pipeline_step, then check validation with hermes_get_pipeline.",
  "Output is compact JSON capped at about 50,000 characters. Narrow a truncated result with a smaller pageSize or a q search.",
  "Mutation tools start with hermes_mutate_. Tools whose description says so need confirm: true on a second call after the user approves.",
  "A rejected mutation returns HTTP 400. Its body.issues names each invalid field.",
  "Switch environments with hermes_set_active_profile when several profiles are configured.",
].join(" ");

export type CreateHermesMcpServerDependencies = {
  getActiveProfile?: typeof getActiveProfile;
  fetchImpl?: typeof fetch;
  whoamiCache?: WhoamiCache;
  serverVersion?: string;
  enabledToolsets?: ReadonlySet<HermesToolset>;
};

export const createHermesMcpServer = (
  dependencies: CreateHermesMcpServerDependencies = {},
): McpServer => {
  const getActiveProfileFn = dependencies.getActiveProfile ?? getActiveProfile;
  const whoamiCache = dependencies.whoamiCache ?? createWhoamiCache();
  const enabledToolsets = dependencies.enabledToolsets ?? loadEnabledToolsets();
  const server = new McpServer(
    {
      name: "hermes-mcp",
      version: dependencies.serverVersion ?? readServerVersion(),
    },
    { instructions: HERMES_MCP_SERVER_INSTRUCTIONS },
  );
  const baseHttpClient = createHermesHttpClient({
    getProfile: () => getActiveProfileFn(),
    fetchImpl: dependencies.fetchImpl,
  });
  const httpClient = withWhoamiCacheInvalidation(baseHttpClient, whoamiCache);
  const resolveProfileKey = (): string | undefined => {
    const resolved = getActiveProfileFn();

    return "error" in resolved
      ? undefined
      : buildProfileCacheKey(resolved.profile);
  };

  registerHermesTools({
    server,
    httpClient,
    enabledToolsets,
    getActiveProfile: getActiveProfileFn,
    onActiveProfileChange: whoamiCache.clear,
  });

  registerHermesMutateTools({
    server,
    httpClient,
    enabledToolsets,
    whoamiCache,
    resolveProfileKey,
  });

  return server;
};
