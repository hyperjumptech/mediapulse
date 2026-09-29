import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export type HermesMutateToolSpec = {
  name: string;
  title: string;
  description: string;
  pathTemplate: string;
  inputSchema: z.ZodRawShape;
  requiresConfirm: boolean;
  annotations: ToolAnnotations;
};

const CREATE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const DELETE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

const CANCEL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

const RUN_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

const CONFIRM_FIRST_SENTENCE =
  "Needs confirm: true on a second call after the user approves.";

const confirmField = {
  confirm: z
    .boolean()
    .optional()
    .describe(
      "Set to true on a second call to run destructive actions (delete, cancel, run).",
    ),
};

const idField = {
  id: z.guid().describe("Resource id"),
};

export const HERMES_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_create_agent",
    title: "Create agent",
    description: "Register a new agent version in the Hermes registry.",
    pathTemplate: "/dashboard/agents/actions/create",
    requiresConfirm: false,
    annotations: CREATE_ANNOTATIONS,
    inputSchema: {
      agentId: z.string().min(1).describe("Agent id"),
      agentVersion: z.string().min(1).describe("Agent version"),
      description: z.string().optional().describe("Optional description"),
      endpoint: z
        .string()
        .optional()
        .describe("JSON object string for agent endpoint config"),
      domainIntegrationId: z
        .guid()
        .optional()
        .describe("Domain integration id"),
      isActive: z.boolean().optional().describe("Whether the agent is active"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_agent",
    title: "Delete agent",
    description: `Delete an agent registry entry. ${CONFIRM_FIRST_SENTENCE}`,
    pathTemplate: "/dashboard/agents/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { ...idField, ...confirmField },
  },
  {
    name: "hermes_mutate_create_variable",
    title: "Create variable",
    description:
      "Create an orchestration variable, optionally stored as a secret.",
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
    pathTemplate: "/dashboard/variables/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { ...idField, ...confirmField },
  },
  {
    name: "hermes_mutate_run_pipeline",
    title: "Run pipeline",
    description: `Enqueue a manual pipeline run. Its agents act on real data. ${CONFIRM_FIRST_SENTENCE}`,
    pathTemplate: "/dashboard/pipelines/actions/run-pipeline",
    requiresConfirm: true,
    annotations: RUN_ANNOTATIONS,
    inputSchema: {
      pipelineId: z.guid().describe("Pipeline id"),
      params: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe(
          "Run parameters that fill {{params.<name>}} placeholders in step input and config.",
        ),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_cancel_pipeline_execution",
    title: "Cancel manual pipeline run",
    description: `Cancel a running manual pipeline execution. ${CONFIRM_FIRST_SENTENCE}`,
    pathTemplate: "/dashboard/pipelines/actions/cancel-manual-execution",
    requiresConfirm: true,
    annotations: CANCEL_ANNOTATIONS,
    inputSchema: {
      pipelineId: z.guid().describe("Pipeline id"),
      manualExecutionId: z.guid().describe("Manual pipeline execution id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_pipeline",
    title: "Delete pipeline",
    description: `Delete a pipeline and its steps. ${CONFIRM_FIRST_SENTENCE}`,
    pathTemplate: "/dashboard/pipelines/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { ...idField, ...confirmField },
  },
  {
    name: "hermes_mutate_cancel_schedule_execution",
    title: "Cancel schedule execution",
    description: `Cancel a running schedule execution. ${CONFIRM_FIRST_SENTENCE}`,
    pathTemplate: "/dashboard/schedules/actions/cancel-execution",
    requiresConfirm: true,
    annotations: CANCEL_ANNOTATIONS,
    inputSchema: {
      scheduleId: z.guid().describe("Schedule id"),
      scheduleExecutionId: z.guid().describe("Schedule execution id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_schedule",
    title: "Delete schedule",
    description: `Delete a schedule. ${CONFIRM_FIRST_SENTENCE}`,
    pathTemplate: "/dashboard/schedules/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { ...idField, ...confirmField },
  },
  {
    name: "hermes_mutate_cancel_http_trigger_execution",
    title: "Cancel HTTP trigger execution",
    description: `Cancel a running HTTP trigger execution. ${CONFIRM_FIRST_SENTENCE}`,
    pathTemplate: "/dashboard/http-triggers/actions/cancel-execution",
    requiresConfirm: true,
    annotations: CANCEL_ANNOTATIONS,
    inputSchema: {
      httpTriggerId: z.guid().describe("HTTP trigger id"),
      httpTriggerExecutionId: z.guid().describe("HTTP trigger execution id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_http_trigger",
    title: "Delete HTTP trigger",
    description: `Delete an HTTP trigger. ${CONFIRM_FIRST_SENTENCE}`,
    pathTemplate: "/dashboard/http-triggers/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { ...idField, ...confirmField },
  },
];

export const buildMutationRequestBody = (
  args: Record<string, unknown>,
): Record<string, unknown> => {
  const body = { ...args };
  delete body.confirm;

  return body;
};
