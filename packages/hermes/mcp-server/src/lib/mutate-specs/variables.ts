import { z } from "zod";

import {
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  guidField,
  UPDATE_ANNOTATIONS,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

export const VARIABLE_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_create_variable",
    title: "Create variable",
    description:
      "Create an orchestration variable, optionally stored as a secret.",
    toolset: "variables",
    pathTemplate: "/dashboard/variables/actions/create",
    requiresConfirm: false,
    annotations: CREATE_ANNOTATIONS,
    inputSchema: {
      key: z.string().min(1).describe("Variable key"),
      value: z.string().describe("Variable value"),
      note: z.string().optional().describe("Optional note"),
      isSecret: z.boolean().optional().describe("Store as secret"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_update_variable",
    title: "Update variable",
    description:
      "Change a variable's key, value, note, or secret flag. Omitted fields keep their value. A blank or masked value keeps the stored one.",
    toolset: "variables",
    pathTemplate: "/dashboard/variables/actions/update",
    requiresConfirm: false,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      id: guidField("Variable id"),
      key: z.string().min(1).optional().describe("Variable key"),
      value: z.string().optional().describe("New value"),
      note: z
        .string()
        .nullable()
        .optional()
        .describe("Note, or null to clear it"),
      isSecret: z
        .boolean()
        .optional()
        .describe(
          "Store as secret. Flipping it re-encrypts or decrypts the value.",
        ),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_variable",
    title: "Delete variable",
    description: `Delete an orchestration variable. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "variables",
    pathTemplate: "/dashboard/variables/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { id: guidField("Variable id"), ...confirmField },
  },
];
