import {
  guidField,
  listToolSpec,
  nonEmptyStringField,
  type HermesReadToolSpec,
} from "../read-tool-spec.js";

export const AGENT_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  listToolSpec({
    name: "hermes_list_agents",
    title: "List agents",
    description:
      "Page through registered agents, including their endpoint and JSON schemas.",
    toolset: "agents",
    pathTemplate: "/api/agents",
    searchHint: "agent id and description",
    sortFields: ["agentId", "agentVersion", "created", "updated"],
    defaultSort: "agentId asc",
  }),
  {
    name: "hermes_get_agent",
    title: "Get agent",
    description:
      "One agent registry entry by id, with its endpoint, schemas, domain integration, and the integration's agent tabs (read them with hermes_get_domain_content).",
    toolset: "agents",
    method: "POST",
    pathTemplate: "/dashboard/agents/actions/get",
    inputSchema: { id: guidField("Agent registry id") },
  },
  {
    name: "hermes_get_agent_schemas",
    title: "Get agent schemas",
    description: "Input and config JSON schemas for one agent version.",
    toolset: "agents",
    method: "GET",
    pathTemplate: "/api/agents/{agentId}/{agentVersion}/schemas",
    inputSchema: {
      agentId: nonEmptyStringField("Agent id"),
      agentVersion: nonEmptyStringField("Agent version"),
    },
  },
  listToolSpec({
    name: "hermes_list_agent_configs",
    title: "List agent configs",
    description: "Page through saved agent configs with their config JSON.",
    toolset: "agents",
    pathTemplate: "/api/agent-configs",
    searchHint: "config name, description, and agent id",
    sortFields: ["name", "createdAt", "agentId"],
    defaultSort: "name asc",
  }),
  {
    name: "hermes_get_agent_config",
    title: "Get agent config",
    description: "One saved agent config by id.",
    toolset: "agents",
    method: "POST",
    pathTemplate: "/dashboard/agent-configs/actions/get",
    inputSchema: { id: guidField("Agent config id") },
  },
  listToolSpec({
    name: "hermes_list_agent_contracts",
    title: "List agent contracts",
    description:
      "Page through agent contracts (versioned briefs pipeline steps pass to agents).",
    toolset: "agents",
    pathTemplate: "/api/agent-contracts",
    searchHint: "contract name, description, and version",
    sortFields: ["name", "createdAt"],
    defaultSort: "name asc",
  }),
  {
    name: "hermes_get_agent_contract",
    title: "Get agent contract",
    description: "One agent contract by id, including its brief.",
    toolset: "agents",
    method: "POST",
    pathTemplate: "/dashboard/agent-contracts/actions/get",
    inputSchema: { id: guidField("Agent contract id") },
  },
];
