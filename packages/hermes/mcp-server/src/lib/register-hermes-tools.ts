import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  formatHermesHttpAsToolResult,
  formatHermesListAsToolResult,
  formatJsonToolResult,
  PAGINATED_LIST_OUTPUT_SHAPE,
} from "./format-tool-result.js";
import type { HermesHttpClient } from "./http-client.js";
import {
  getActiveProfile,
  listProfileSummary,
  normalizeProfileName,
  setActiveProfileOverride,
} from "./profiles.js";
import {
  buildRequestBodyForSpec,
  buildSearchParamsForSpec,
  HERMES_READ_TOOL_SPECS,
  resolvePathTemplate,
  type HermesReadToolSpec,
} from "./tool-catalog.js";
import { HERMES_TOOLSETS, type HermesToolset } from "./toolsets.js";

const READ_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const PROFILE_SWITCH_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export type RegisterHermesToolsDependencies = {
  server: McpServer;
  httpClient: HermesHttpClient;
  additionalReadToolSpecs?: HermesReadToolSpec[];
  enabledToolsets?: ReadonlySet<HermesToolset>;
  getActiveProfile?: typeof getActiveProfile;
  listProfileSummary?: typeof listProfileSummary;
  setActiveProfileOverride?: typeof setActiveProfileOverride;
  onActiveProfileChange?: () => void;
};

export const handleHermesReadToolCall = async (
  spec: HermesReadToolSpec,
  args: Record<string, unknown>,
  httpClient: HermesHttpClient,
): Promise<CallToolResult> => {
  const response = await httpClient.request({
    method: spec.method,
    path: resolvePathTemplate(spec.pathTemplate, args),
    body: buildRequestBodyForSpec(spec, args),
    searchParams:
      spec.method === "GET" ? buildSearchParamsForSpec(spec, args) : undefined,
  });

  return spec.paginated
    ? formatHermesListAsToolResult(response)
    : formatHermesHttpAsToolResult(response);
};

export const registerHermesReadToolSpecs = (
  server: McpServer,
  httpClient: HermesHttpClient,
  specs: HermesReadToolSpec[],
): void => {
  for (const spec of specs) {
    server.registerTool(
      spec.name,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: spec.inputSchema,
        outputSchema: spec.paginated ? PAGINATED_LIST_OUTPUT_SHAPE : undefined,
        annotations: { title: spec.title, ...READ_TOOL_ANNOTATIONS },
      },
      async (args: Record<string, unknown>) =>
        handleHermesReadToolCall(spec, args, httpClient),
    );
  }
};

export const registerHermesTools = ({
  server,
  httpClient,
  additionalReadToolSpecs = [],
  enabledToolsets = new Set(HERMES_TOOLSETS),
  getActiveProfile: getActiveProfileFn = getActiveProfile,
  listProfileSummary: listProfileSummaryFn = listProfileSummary,
  setActiveProfileOverride:
    setActiveProfileOverrideFn = setActiveProfileOverride,
  onActiveProfileChange,
}: RegisterHermesToolsDependencies): void => {
  const readToolSpecs = [
    ...HERMES_READ_TOOL_SPECS,
    ...additionalReadToolSpecs,
  ].filter((spec) => enabledToolsets.has(spec.toolset));

  registerHermesReadToolSpecs(server, httpClient, readToolSpecs);

  server.registerTool(
    "hermes_list_profiles",
    {
      title: "List profiles",
      description:
        "List configured Hermes profile names and the active one. Never returns API keys.",
      inputSchema: {},
      annotations: { title: "List profiles", ...READ_TOOL_ANNOTATIONS },
    },
    async () => {
      const summary = listProfileSummaryFn();

      return formatJsonToolResult(summary, { isError: Boolean(summary.error) });
    },
  );

  server.registerTool(
    "hermes_set_active_profile",
    {
      title: "Switch profile",
      description:
        "Switch the Hermes profile used by later tool calls in this session. Does not change the environment.",
      inputSchema: {
        profile: z
          .string()
          .describe("Profile name (matches HERMES_MCP_PROFILE_<NAME>_*)"),
      },
      annotations: { title: "Switch profile", ...PROFILE_SWITCH_ANNOTATIONS },
    },
    async ({ profile }: { profile: string }) => {
      const summary = listProfileSummaryFn();
      const normalized = normalizeProfileName(profile);

      if (!summary.profiles.includes(normalized)) {
        const configuredProfiles = summary.profiles.join(", ") || "(none)";

        return formatJsonToolResult(
          {
            error: `Unknown profile "${profile}". Configured: ${configuredProfiles}.`,
          },
          { isError: true },
        );
      }

      setActiveProfileOverrideFn(normalized);
      onActiveProfileChange?.();
      const activeCheck = getActiveProfileFn();
      if ("error" in activeCheck) {
        return formatJsonToolResult(
          { error: activeCheck.error },
          { isError: true },
        );
      }

      return formatJsonToolResult({
        active: activeCheck.profile.name,
        baseUrl: activeCheck.profile.baseUrl,
      });
    },
  );
};
