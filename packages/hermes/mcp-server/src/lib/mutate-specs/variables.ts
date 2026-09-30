import { z } from "zod";

import {
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  guidField,
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
