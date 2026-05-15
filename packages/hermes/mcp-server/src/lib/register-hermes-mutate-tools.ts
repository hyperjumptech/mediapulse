import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  formatHermesHttpAsToolResult,
  formatHermesToolError,
} from "./format-tool-result.js";
import type { HermesHttpClient } from "./http-client.js";
import { assertMutationAllowed } from "./mutation-access.js";
import {
  buildMutationRequestBody,
  type HermesMutateToolSpec,
  HERMES_MUTATE_TOOL_SPECS,
} from "./mutate-tool-catalog.js";

const DESTRUCTIVE_CONFIRM_MESSAGE =
  "Destructive Hermes mutation blocked. Call this tool again with confirm: true after the user approves. No HTTP request was sent.";

export type HandleHermesMutateToolCallDependencies = {
  httpClient: HermesHttpClient;
  assertMutationAllowed?: typeof assertMutationAllowed;
};

/**
 * Runs one Hermes mutation tool (confirm gate, read-only check, HTTP POST).
 *
 * @param spec - Mutation tool specification.
 * @param args - Tool arguments from the MCP client.
 * @param dependencies - HTTP client and optional access guard.
 * @returns MCP tool result.
 */
export const handleHermesMutateToolCall = async (
  spec: HermesMutateToolSpec,
  args: Record<string, unknown>,
  {
    httpClient,
    assertMutationAllowed: assertMutationAllowedFn = assertMutationAllowed,
  }: HandleHermesMutateToolCallDependencies,
): Promise<CallToolResult> => {
  if (spec.requiresConfirm && args.confirm !== true) {
    return formatHermesToolError(DESTRUCTIVE_CONFIRM_MESSAGE, {
      requiredField: "confirm",
      requiredValue: true,
    });
  }

  const access = await assertMutationAllowedFn({ httpClient });
  if (!("allowed" in access)) {
    return access;
  }

  const response = await httpClient.request({
    method: "POST",
    path: spec.pathTemplate,
    body: buildMutationRequestBody(args),
  });

  return formatHermesHttpAsToolResult(response);
};

export type RegisterHermesMutateToolsDependencies = {
  server: McpServer;
  httpClient: HermesHttpClient;
  assertMutationAllowed?: typeof assertMutationAllowed;
};

/**
 * Registers Hermes mutation MCP tools with confirm gate and read-only checks.
 *
 * @param dependencies - MCP server, HTTP client, and optional access guard for tests.
 */
export const registerHermesMutateTools = ({
  server,
  httpClient,
  assertMutationAllowed: assertMutationAllowedFn = assertMutationAllowed,
}: RegisterHermesMutateToolsDependencies): void => {
  for (const spec of HERMES_MUTATE_TOOL_SPECS) {
    server.registerTool(
      spec.name,
      {
        description: spec.description,
        inputSchema: spec.inputSchema,
        annotations: spec.requiresConfirm
          ? { destructiveHint: true }
          : undefined,
      },
      async (args: Record<string, unknown>) =>
        handleHermesMutateToolCall(spec, args, {
          httpClient,
          assertMutationAllowed: assertMutationAllowedFn,
        }),
    );
  }
};
