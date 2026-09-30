import { readFile, stat, writeFile } from "node:fs/promises";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  formatHermesHttpAsToolResult,
  formatHermesToolError,
} from "./format-tool-result.js";
import type { HermesHttpClient, HermesHttpResponse } from "./http-client.js";
import { assertMutationAllowed, type WhoamiCache } from "./mutation-access.js";
import {
  buildMutationRequestBody,
  type HermesMutateToolSpec,
  HERMES_MUTATE_TOOL_SPECS,
} from "./mutate-tool-catalog.js";
import { HERMES_TOOLSETS, type HermesToolset } from "./toolsets.js";

const CONFIRM_REQUIRED_MESSAGE =
  "Hermes mutation blocked until confirmed. Call this tool again with confirm: true after the user approves. No HTTP request was sent.";

export type WriteSecretFile = (path: string, contents: string) => Promise<void>;

export type ReadPayloadFile = (path: string) => Promise<string>;

export const MAX_PAYLOAD_FILE_BYTES = 16 * 1024 * 1024;

const readPayloadFileFromDisk: ReadPayloadFile = async (path) => {
  const fileStats = await stat(path);
  if (fileStats.size > MAX_PAYLOAD_FILE_BYTES) {
    throw new Error(`${path} is larger than 16 MB`);
  }

  return readFile(path, "utf8");
};

const writeSecretFileExclusively: WriteSecretFile = async (path, contents) => {
  await writeFile(path, contents, { flag: "wx", mode: 0o600 });
};

const isSuccessfulResponse = (response: HermesHttpResponse): boolean =>
  response.status >= 200 && response.status < 300;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const secretFileContents = (
  body: Record<string, unknown>,
  secretFields: readonly string[],
): string | undefined => {
  const values = secretFields
    .map((field) => body[field])
    .filter((value): value is string => typeof value === "string");
  if (values.length === 0) {
    return undefined;
  }

  return `${values.join("\n")}\n`;
};

const redactSecretFields = (
  body: Record<string, unknown>,
  secretFields: readonly string[],
  secretFilePath: string,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(body).map(([key, value]) =>
      secretFields.includes(key)
        ? [key, `[written to ${secretFilePath}]`]
        : [key, value],
    ),
  );

const moveSecretsToFile = async (
  response: HermesHttpResponse,
  secretFields: readonly string[],
  secretFilePath: string,
  writeSecretFile: WriteSecretFile,
): Promise<HermesHttpResponse> => {
  const body = response.body;
  if (!isRecord(body)) {
    return response;
  }
  const contents = secretFileContents(body, secretFields);
  if (contents === undefined) {
    return response;
  }
  try {
    await writeSecretFile(secretFilePath, contents);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return {
      ...response,
      body: {
        ...body,
        secretFileError: `Could not write ${secretFilePath}: ${reason}. The secret is returned here instead, store it now.`,
      },
    };
  }

  return {
    ...response,
    body: redactSecretFields(body, secretFields, secretFilePath),
  };
};

export type HandleHermesMutateToolCallDependencies = {
  httpClient: HermesHttpClient;
  assertMutationAllowed?: typeof assertMutationAllowed;
  whoamiCache?: WhoamiCache;
  resolveProfileKey?: () => string | undefined;
  writeSecretFile?: WriteSecretFile;
  readPayloadFile?: ReadPayloadFile;
};

export const handleHermesMutateToolCall = async (
  spec: HermesMutateToolSpec,
  args: Record<string, unknown>,
  {
    httpClient,
    assertMutationAllowed: assertMutationAllowedFn = assertMutationAllowed,
    whoamiCache,
    resolveProfileKey,
    writeSecretFile = writeSecretFileExclusively,
    readPayloadFile = readPayloadFileFromDisk,
  }: HandleHermesMutateToolCallDependencies,
): Promise<CallToolResult> => {
  if (spec.requiresConfirm && args.confirm !== true) {
    return formatHermesToolError(CONFIRM_REQUIRED_MESSAGE, {
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

  const requestBody = buildMutationRequestBody(args);
  const payloadFilePath = args.payloadFilePath;
  if (spec.payloadFileField && typeof payloadFilePath === "string") {
    if (requestBody[spec.payloadFileField] !== undefined) {
      return formatHermesToolError(
        `Pass either ${spec.payloadFileField} or payloadFilePath, not both.`,
      );
    }
    try {
      requestBody[spec.payloadFileField] =
        await readPayloadFile(payloadFilePath);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      return formatHermesToolError(`Could not read payloadFilePath: ${reason}`);
    }
  }
  const response = await httpClient.request({
    method: "POST",
    path: spec.pathTemplate,
    body: requestBody,
  });
  const secretFilePath = args.secretFilePath;
  if (
    spec.secretFields &&
    typeof secretFilePath === "string" &&
    isSuccessfulResponse(response)
  ) {
    const redactedResponse = await moveSecretsToFile(
      response,
      spec.secretFields,
      secretFilePath,
      writeSecretFile,
    );

    return formatHermesHttpAsToolResult(redactedResponse);
  }

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
