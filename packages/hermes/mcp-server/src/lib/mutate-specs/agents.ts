import { z } from "zod";

import {
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  guidField,
  jsonObjectField,
  UPDATE_ANNOTATIONS,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

const agentConfigFields = {
  name: z.string().min(1).describe("Config name"),
  description: z.string().optional().describe("Optional description"),
  agentId: z.string().min(1).describe("Agent id the config is for"),
  agentVersion: z.string().min(1).describe("Agent version the config is for"),
  config: jsonObjectField(
    "Config object, validated against the agent's config schema",
  ).optional(),
};

const agentContractFields = {
  name: z.string().min(1).describe("Contract name"),
  description: z.string().optional().describe("Optional description"),
  brief: z.string().min(1).describe("Brief text the agent receives"),
  version: z.string().min(1).describe("Contract version label"),
};

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
    name: "hermes_mutate_update_agent",
    title: "Update agent",
    description:
      "Change an agent registry entry's id, version, description, endpoint, or active flag. Omitted fields keep their value.",
    toolset: "agents",
    pathTemplate: "/dashboard/agents/actions/update",
    requiresConfirm: false,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      id: guidField("Agent registry id"),
      agentId: z.string().min(1).optional().describe("Agent id"),
      agentVersion: z.string().min(1).optional().describe("Agent version"),
      description: z
        .string()
        .nullable()
        .optional()
        .describe("Description, or null to clear it"),
      endpoint: jsonObjectField("Agent endpoint config object").optional(),
      isActive: z.boolean().optional().describe("Whether the agent is active"),
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
  {
    name: "hermes_mutate_create_agent_config",
    title: "Create agent config",
    description:
      "Save a reusable config for one agent version. Returns id. Steps reference it through agentConfigId.",
    toolset: "agents",
    pathTemplate: "/dashboard/agent-configs/actions/create",
    requiresConfirm: false,
    annotations: CREATE_ANNOTATIONS,
    inputSchema: { ...agentConfigFields, ...confirmField },
  },
  {
    name: "hermes_mutate_update_agent_config",
    title: "Update agent config",
    description:
      "Replace a saved agent config. Send every field. An omitted config becomes {}.",
    toolset: "agents",
    pathTemplate: "/dashboard/agent-configs/actions/update",
    requiresConfirm: false,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      id: guidField("Agent config id"),
      ...agentConfigFields,
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_agent_config",
    title: "Delete agent config",
    description: `Delete a saved agent config. Refused while a pipeline step uses it. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "agents",
    pathTemplate: "/dashboard/agent-configs/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { id: guidField("Agent config id"), ...confirmField },
  },
  {
    name: "hermes_mutate_create_agent_contract",
    title: "Create agent contract",
    description:
      "Create a contract, a versioned brief that pipeline steps pass to their agent. Returns id.",
    toolset: "agents",
    pathTemplate: "/dashboard/agent-contracts/actions/create",
    requiresConfirm: false,
    annotations: CREATE_ANNOTATIONS,
    inputSchema: { ...agentContractFields, ...confirmField },
  },
  {
    name: "hermes_mutate_update_agent_contract",
    title: "Update agent contract",
    description: "Replace an agent contract. Send every field.",
    toolset: "agents",
    pathTemplate: "/dashboard/agent-contracts/actions/update",
    requiresConfirm: false,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      id: guidField("Agent contract id"),
      ...agentContractFields,
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_agent_contract",
    title: "Delete agent contract",
    description: `Delete an agent contract. Refused while a pipeline step uses it. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "agents",
    pathTemplate: "/dashboard/agent-contracts/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { id: guidField("Agent contract id"), ...confirmField },
  },
];
