import { z } from "zod";

/** Describes one Hermes mutation MCP tool and its backing dashboard POST route. */
export type HermesMutateToolSpec = {
  name: string;
  description: string;
  pathTemplate: string;
  inputSchema: z.ZodRawShape;
  /** When true, `confirm: true` is required or no HTTP request is sent. */
  requiresConfirm: boolean;
};

const confirmField = {
  confirm: z
    .boolean()
    .optional()
    .describe(
      "Set to true on a second call to run destructive actions (delete, cancel, run).",
    ),
};

const idField = {
  id: z.string().uuid().describe("Resource id"),
};

/**
 * Phase B mutation tools mapped to dashboard `route-action-gen` POST routes.
 */
export const HERMES_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_create_agent",
    description: "Register a new agent in the Hermes registry.",
    pathTemplate: "/dashboard/agents/actions/create",
    requiresConfirm: false,
    inputSchema: {
      agentId: z.string().min(1).describe("Agent id"),
      agentVersion: z.string().min(1).describe("Agent version"),
      description: z.string().optional().describe("Optional description"),
      endpoint: z
        .string()
        .optional()
        .describe("JSON object string for agent endpoint config"),
      domainIntegrationId: z
        .string()
        .uuid()
        .optional()
        .describe("Domain integration id"),
      isActive: z.boolean().optional().describe("Whether the agent is active"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_agent",
    description: "Delete an agent registry entry (destructive).",
    pathTemplate: "/dashboard/agents/actions/delete",
    requiresConfirm: true,
    inputSchema: { ...idField, ...confirmField },
  },
  {
    name: "hermes_mutate_create_variable",
    description: "Create an orchestration variable.",
    pathTemplate: "/dashboard/variables/actions/create",
    requiresConfirm: false,
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
    description: "Delete a variable (destructive).",
    pathTemplate: "/dashboard/variables/actions/delete",
    requiresConfirm: true,
    inputSchema: { ...idField, ...confirmField },
  },
  {
    name: "hermes_mutate_run_pipeline",
    description: "Enqueue a manual pipeline run (destructive side effects).",
    pathTemplate: "/dashboard/pipelines/actions/run-pipeline",
    requiresConfirm: true,
    inputSchema: {
      pipelineId: z.string().uuid().describe("Pipeline id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_cancel_pipeline_execution",
    description: "Cancel a manual pipeline execution (destructive).",
    pathTemplate: "/dashboard/pipelines/actions/cancel-manual-execution",
    requiresConfirm: true,
    inputSchema: {
      pipelineId: z.string().uuid().describe("Pipeline id"),
      manualExecutionId: z
        .string()
        .uuid()
        .describe("Manual pipeline execution id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_pipeline",
    description: "Delete a pipeline (destructive).",
    pathTemplate: "/dashboard/pipelines/actions/delete",
    requiresConfirm: true,
    inputSchema: { ...idField, ...confirmField },
  },
  {
    name: "hermes_mutate_cancel_schedule_execution",
    description: "Cancel a schedule execution (destructive).",
    pathTemplate: "/dashboard/schedules/actions/cancel-execution",
    requiresConfirm: true,
    inputSchema: {
      scheduleId: z.string().uuid().describe("Schedule id"),
      scheduleExecutionId: z.string().uuid().describe("Schedule execution id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_schedule",
    description: "Delete a schedule (destructive).",
    pathTemplate: "/dashboard/schedules/actions/delete",
    requiresConfirm: true,
    inputSchema: { ...idField, ...confirmField },
  },
  {
    name: "hermes_mutate_cancel_http_trigger_execution",
    description: "Cancel an HTTP trigger execution (destructive).",
    pathTemplate: "/dashboard/http-triggers/actions/cancel-execution",
    requiresConfirm: true,
    inputSchema: {
      httpTriggerId: z.string().uuid().describe("HTTP trigger id"),
      httpTriggerExecutionId: z
        .string()
        .uuid()
        .describe("HTTP trigger execution id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_http_trigger",
    description: "Delete an HTTP trigger (destructive).",
    pathTemplate: "/dashboard/http-triggers/actions/delete",
    requiresConfirm: true,
    inputSchema: { ...idField, ...confirmField },
  },
];

/**
 * Builds the JSON body for a mutation route from tool arguments (excludes `confirm`).
 *
 * @param args - Tool arguments from the MCP client.
 * @returns Request body for route-action-gen POST handlers.
 */
export const buildMutationRequestBody = (
  args: Record<string, unknown>,
): Record<string, unknown> => {
  const body = { ...args };
  delete body.confirm;
  return body;
};
