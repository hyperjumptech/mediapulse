import { z } from "zod";

import {
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  guidField,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

export const AGENT_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_create_agent",
    title: "Create agent",
    description:
      "Register a new agent version in the Hermes registry. It starts inactive unless isActive is true.",
    toolset: "agents",
    pathTemplate: "/dashboard/agents/actions/create",
    requiresConfirm: false,
    annotations: CREATE_ANNOTATIONS,
    inputSchema: {
      agentId: z.string().min(1).describe("Agent id"),
      agentVersion: z.string().min(1).describe("Agent version"),
      description: z.string().optional().describe("Optional description"),
      endpoint: z
        .record(z.string(), z.unknown())
        .describe("Agent endpoint config object, for example url and method"),
      domainIntegrationId: z
        .guid()
        .optional()
        .describe("Domain integration id. Default: the default integration."),
      isActive: z
        .boolean()
        .optional()
        .describe("Whether the agent is active. Default false."),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_agent",
    title: "Delete agent",
    description: `Delete an agent registry entry. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "agents",
    pathTemplate: "/dashboard/agents/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { id: guidField("Agent registry id"), ...confirmField },
  },
];
