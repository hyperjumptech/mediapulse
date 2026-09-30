import { isAbsolute } from "node:path";

import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { HermesToolset } from "./toolsets.js";

export type HermesMutateToolSpec = {
  name: string;
  title: string;
  description: string;
  toolset: HermesToolset;
  pathTemplate: string;
  inputSchema: z.ZodRawShape;
  requiresConfirm: boolean;
  confirmReason?: "destructive" | "credential";
  secretFields?: readonly string[];
  annotations: ToolAnnotations;
};

export const CREATE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const CREDENTIAL_CREATE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const UPDATE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

export const DELETE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

export const CANCEL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

export const RUN_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export const CONFIRM_FIRST_SENTENCE =
  "Needs confirm: true on a second call after the user approves.";

export const CREDENTIAL_CONFIRM_SENTENCE =
  "Needs confirm: true on a second call after the user approves, because it returns a credential once.";

export const LOCAL_ONLY_FIELDS: readonly string[] = [
  "confirm",
  "secretFilePath",
];

export const secretFilePathField = {
  secretFilePath: z
    .string()
    .refine(isAbsolute, "secretFilePath must be an absolute path")
    .optional()
    .describe(
      "Absolute path of a new file to receive the secret instead of this conversation. Written with mode 600 and never overwrites.",
    ),
};

export const confirmField = {
  confirm: z
    .boolean()
    .optional()
    .describe(
      "Set to true on a second call, after the user approves, to run a tool that needs confirmation.",
    ),
};

export const guidField = (description: string) =>
  z.guid().describe(description);

export const jsonObjectField = (description: string) =>
  z.record(z.string(), z.unknown()).describe(description);
