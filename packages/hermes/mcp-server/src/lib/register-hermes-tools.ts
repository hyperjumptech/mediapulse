import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { HermesHttpClient } from "./http-client.js";
import { formatHermesHttpAsToolResult } from "./format-tool-result.js";
import {
  getActiveProfile,
  listProfileSummary,
  normalizeProfileName,
  setActiveProfileOverride,
} from "./profiles.js";
import {
  buildRequestBodyForSpec,
  extractListSearchParams,
  HERMES_READ_TOOL_SPECS,
  resolvePathTemplate,
  type HermesReadToolSpec,
} from "./tool-catalog.js";

export type RegisterHermesToolsDependencies = {
  server: McpServer;
  httpClient: HermesHttpClient;
  additionalReadToolSpecs?: HermesReadToolSpec[];
  getActiveProfile?: typeof getActiveProfile;
  listProfileSummary?: typeof listProfileSummary;
  setActiveProfileOverride?: typeof setActiveProfileOverride;
};

/**
 * Registers read-only HTTP-backed tools on an MCP server.
 *
 * @param server - MCP server instance.
 * @param httpClient - Hermes dashboard HTTP client.
 * @param specs - Tool specifications to register.
 */
export const registerHermesReadToolSpecs = (
  server: McpServer,
  httpClient: HermesHttpClient,
  specs: HermesReadToolSpec[],
): void => {
  for (const spec of specs) {
    server.registerTool(
      spec.name,
      {
        description: spec.description,
        inputSchema: spec.inputSchema,
        annotations: { readOnlyHint: true },
      },
      async (args: Record<string, unknown>) => {
        const path = resolvePathTemplate(spec.pathTemplate, args);
        const body = buildRequestBodyForSpec(spec, args);
        const searchParams =
          spec.method === "GET" && spec.pathTemplate.startsWith("/api/")
            ? extractListSearchParams(args)
            : undefined;

        const response = await httpClient.request({
          method: spec.method,
          path,
          body,
          searchParams:
            searchParams && Object.keys(searchParams).length > 0
              ? searchParams
              : undefined,
        });

        return formatHermesHttpAsToolResult(response);
      },
    );
  }
};

/**
 * Registers Hermes read tools and profile management tools on an MCP server.
 *
 * @param dependencies - MCP server instance, HTTP client, and optional profile helpers.
 */
export const registerHermesTools = ({
  server,
  httpClient,
  additionalReadToolSpecs = [],
  getActiveProfile: getActiveProfileFn = getActiveProfile,
  listProfileSummary: listProfileSummaryFn = listProfileSummary,
  setActiveProfileOverride:
    setActiveProfileOverrideFn = setActiveProfileOverride,
}: RegisterHermesToolsDependencies): void => {
  registerHermesReadToolSpecs(server, httpClient, [
    ...HERMES_READ_TOOL_SPECS,
    ...additionalReadToolSpecs,
  ]);

  server.registerTool(
    "hermes_list_profiles",
    {
      description:
        "List configured Hermes MCP profile names and which profile is active (no secrets).",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const summary = listProfileSummaryFn();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary, null, 2),
          },
        ],
        ...(summary.error ? { isError: true } : {}),
      };
    },
  );

  server.registerTool(
    "hermes_set_active_profile",
    {
      description:
        "Switch the active Hermes MCP profile for subsequent tool calls (in-process; does not change env).",
      inputSchema: {
        profile: z
          .string()
          .describe("Profile name (matches HERMES_MCP_PROFILE_<NAME>_*)"),
      },
    },
    async ({ profile }: { profile: string }) => {
      const summary = listProfileSummaryFn();
      const normalized = normalizeProfileName(profile);

      if (!summary.profiles.includes(normalized)) {
        const payload = {
          error: `Unknown profile "${profile}". Configured: ${summary.profiles.join(", ") || "(none)"}.`,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          isError: true,
        };
      }

      setActiveProfileOverrideFn(normalized);
      const activeCheck = getActiveProfileFn();
      if ("error" in activeCheck) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: activeCheck.error }, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                active: activeCheck.profile.name,
                baseUrl: activeCheck.profile.baseUrl,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
};
