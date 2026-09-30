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
  annotations: ToolAnnotations;
};

export const CREATE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
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

export const LOCAL_ONLY_FIELDS: readonly string[] = ["confirm"];

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
