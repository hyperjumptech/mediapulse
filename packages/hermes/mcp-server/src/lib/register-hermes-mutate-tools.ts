import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  formatHermesHttpAsToolResult,
  formatHermesToolError,
} from "./format-tool-result.js";
import type { HermesHttpClient } from "./http-client.js";
import { assertMutationAllowed, type WhoamiCache } from "./mutation-access.js";
import {
  buildMutationRequestBody,
  type HermesMutateToolSpec,
  HERMES_MUTATE_TOOL_SPECS,
} from "./mutate-tool-catalog.js";
import { HERMES_TOOLSETS, type HermesToolset } from "./toolsets.js";

const DESTRUCTIVE_CONFIRM_MESSAGE =
  "Destructive Hermes mutation blocked. Call this tool again with confirm: true after the user approves. No HTTP request was sent.";

export type HandleHermesMutateToolCallDependencies = {
  httpClient: HermesHttpClient;
  assertMutationAllowed?: typeof assertMutationAllowed;
  whoamiCache?: WhoamiCache;
  resolveProfileKey?: () => string | undefined;
};

export const handleHermesMutateToolCall = async (
  spec: HermesMutateToolSpec,
  args: Record<string, unknown>,
  {
    httpClient,
    assertMutationAllowed: assertMutationAllowedFn = assertMutationAllowed,
    whoamiCache,
    resolveProfileKey,
  }: HandleHermesMutateToolCallDependencies,
): Promise<CallToolResult> => {
  if (spec.requiresConfirm && args.confirm !== true) {
    return formatHermesToolError(DESTRUCTIVE_CONFIRM_MESSAGE, {
      requiredField: "confirm",
      requiredValue: true,
    });
  }

  const access = await assertMutationAllowedFn({
    httpClient,
    whoamiCache,
    profileKey: resolveProfileKey?.(),
  });
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
  enabledToolsets?: ReadonlySet<HermesToolset>;
  assertMutationAllowed?: typeof assertMutationAllowed;
  whoamiCache?: WhoamiCache;
  resolveProfileKey?: () => string | undefined;
};

export const registerHermesMutateTools = ({
  server,
  httpClient,
  enabledToolsets = new Set(HERMES_TOOLSETS),
  assertMutationAllowed: assertMutationAllowedFn = assertMutationAllowed,
  whoamiCache,
  resolveProfileKey,
}: RegisterHermesMutateToolsDependencies): void => {
  const mutateToolSpecs = HERMES_MUTATE_TOOL_SPECS.filter((spec) =>
    enabledToolsets.has(spec.toolset),
  );
  for (const spec of mutateToolSpecs) {
    server.registerTool(
      spec.name,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: spec.inputSchema,
        annotations: { title: spec.title, ...spec.annotations },
      },
      async (args: Record<string, unknown>) =>
        handleHermesMutateToolCall(spec, args, {
          httpClient,
          assertMutationAllowed: assertMutationAllowedFn,
          whoamiCache,
          resolveProfileKey,
        }),
    );
  }
};
