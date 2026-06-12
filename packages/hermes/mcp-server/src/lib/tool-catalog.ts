import { z } from "zod";

import type { HermesHttpMethod } from "./http-client.js";

/** Describes one Hermes read MCP tool and its backing HTTP route. */
export type HermesReadToolSpec = {
  name: string;
  description: string;
  method: HermesHttpMethod;
  /** Path template with `{param}` placeholders. */
  pathTemplate: string;
  inputSchema: z.ZodRawShape;
};

const optionalPagination = {
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Max items per page (list endpoints)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous list response"),
};

/**
 * Phase A read tools mapped to Hermes HTTP routes (PRD §5.1).
 * List routes require dashboard list APIs (HERMES-DASH-MCP-005).
 */
export const HERMES_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  {
    name: "hermes_ping",
    description:
      "Verify API key and profile. Returns key label, read-only flag, and owner user (GET /api/mcp/whoami).",
    method: "GET",
    pathTemplate: "/api/mcp/whoami",
    inputSchema: {},
  },
  {
    name: "hermes_get_agent_schemas",
    description: "Agent input and config JSON schemas from the registry.",
    method: "GET",
    pathTemplate: "/api/agents/{agentId}/{agentVersion}/schemas",
    inputSchema: {
      agentId: z.string().describe("Agent id"),
      agentVersion: z.string().describe("Agent version"),
    },
  },
  {
    name: "hermes_get_pipeline_schemas",
    description: "Pipeline step input schemas.",
    method: "GET",
    pathTemplate: "/api/pipelines/{pipelineId}/schemas",
    inputSchema: {
      pipelineId: z.string().uuid().describe("Pipeline id"),
    },
  },
  {
    name: "hermes_get_schedule_execution",
    description: "Schedule execution detail.",
    method: "GET",
    pathTemplate: "/api/schedules/{scheduleId}/executions/{executionId}",
    inputSchema: {
      scheduleId: z.string().uuid().describe("Schedule id"),
      executionId: z.string().uuid().describe("Execution id"),
    },
  },
  {
    name: "hermes_get_http_trigger_execution",
    description: "HTTP trigger execution detail.",
    method: "GET",
    pathTemplate: "/api/http-triggers/{triggerId}/executions/{executionId}",
    inputSchema: {
      triggerId: z.string().uuid().describe("HTTP trigger id"),
      executionId: z.string().uuid().describe("Execution id"),
    },
  },
  {
    name: "hermes_get_pipeline_execution",
    description: "Manual pipeline execution detail.",
    method: "GET",
    pathTemplate: "/api/pipelines/{pipelineId}/executions/{executionId}",
    inputSchema: {
      pipelineId: z.string().uuid().describe("Pipeline id"),
      executionId: z.string().uuid().describe("Execution id"),
    },
  },
  {
    name: "hermes_get_variable",
    description: "Variable by id (secret values masked on server).",
    method: "POST",
    pathTemplate: "/dashboard/variables/actions/get",
    inputSchema: {
      id: z.string().uuid().describe("Variable id"),
    },
  },
  {
    name: "hermes_get_agent_config",
    description: "Agent config by id.",
    method: "POST",
    pathTemplate: "/dashboard/agent-configs/actions/get",
    inputSchema: {
      id: z.string().uuid().describe("Agent config id"),
    },
  },
  {
    name: "hermes_list_agents",
    description: "List registered agents.",
    method: "GET",
    pathTemplate: "/api/agents",
    inputSchema: { ...optionalPagination },
  },
  {
    name: "hermes_list_schedules",
    description: "List schedules.",
    method: "GET",
    pathTemplate: "/api/schedules",
    inputSchema: { ...optionalPagination },
  },
  {
    name: "hermes_list_pipelines",
    description: "List pipelines.",
    method: "GET",
    pathTemplate: "/api/pipelines",
    inputSchema: { ...optionalPagination },
  },
  {
    name: "hermes_list_http_triggers",
    description: "List HTTP triggers.",
    method: "GET",
    pathTemplate: "/api/http-triggers",
    inputSchema: { ...optionalPagination },
  },
  {
    name: "hermes_list_variables",
    description: "List variables (secret values redacted in list).",
    method: "GET",
    pathTemplate: "/api/variables",
    inputSchema: { ...optionalPagination },
  },
  {
    name: "hermes_list_agent_configs",
    description: "List agent configs.",
    method: "GET",
    pathTemplate: "/api/agent-configs",
    inputSchema: { ...optionalPagination },
  },
  {
    name: "hermes_list_domain_integrations",
    description: "List domain integrations.",
    method: "GET",
    pathTemplate: "/api/domain-integrations",
    inputSchema: { ...optionalPagination },
  },
];

/**
 * Substitutes `{param}` placeholders in a path template with argument values.
 *
 * @param pathTemplate - Route template.
 * @param args - Tool arguments (string values used for substitution).
 * @returns Resolved path.
 */
export const resolvePathTemplate = (
  pathTemplate: string,
  args: Record<string, unknown>,
): string => {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = args[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
};

/**
 * Builds the request body for POST read tools (route-action-gen expects JSON body fields).
 *
 * @param spec - Tool specification.
 * @param args - Validated tool arguments.
 * @returns Body object or undefined for GET.
 */
export const buildRequestBodyForSpec = (
  spec: HermesReadToolSpec,
  args: Record<string, unknown>,
): unknown | undefined => {
  if (spec.method !== "POST") {
    return undefined;
  }

  if (
    spec.pathTemplate === "/dashboard/variables/actions/get" ||
    spec.pathTemplate === "/dashboard/agent-configs/actions/get"
  ) {
    return { id: args.id };
  }

  return args;
};

/**
 * Extracts query params for list GET tools from tool arguments.
 *
 * @param args - Validated tool arguments.
 * @returns Search params for the HTTP client.
 */
export const extractListSearchParams = (
  args: Record<string, unknown>,
): Record<string, string | number | undefined> => {
  const params: Record<string, string | number | undefined> = {};
  if (args.limit !== undefined) {
    params.limit = args.limit as number;
  }
  if (args.cursor !== undefined) {
    params.cursor = args.cursor as string;
  }
  if (args.outcome !== undefined) {
    params.outcome = args.outcome as string;
  }
  if (args.tickerId !== undefined) {
    params.tickerId = args.tickerId as string;
  }
  return params;
};
