import { z } from "zod";

import {
  CANCEL_ANNOTATIONS,
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  guidField,
  jsonObjectField,
  RUN_ANNOTATIONS,
  UPDATE_ANNOTATIONS,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

const timeoutField = z
  .number()
  .int()
  .positive()
  .describe("Run timeout in milliseconds");

export const PIPELINE_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_create_pipeline",
    title: "Create pipeline",
    description:
      "Create an empty pipeline and return its id. Add steps with hermes_mutate_add_agent_step or hermes_mutate_add_pipeline_step.",
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/create",
    requiresConfirm: false,
    annotations: CREATE_ANNOTATIONS,
    inputSchema: {
      name: z.string().min(1).describe("Pipeline name"),
      description: z.string().optional().describe("Optional description"),
      isActive: z
        .boolean()
        .optional()
        .describe("Whether schedules and triggers may run it. Default true."),
      domainIntegrationId: guidField(
        "Domain integration id. Default: the default integration.",
      ).optional(),
      timeout: timeoutField.optional(),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_update_pipeline",
    title: "Update pipeline",
    description:
      "Change a pipeline's name, description, active flag, domain integration, or timeout. Omitted fields keep their value.",
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/update",
    requiresConfirm: false,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
      name: z.string().min(1).optional().describe("Pipeline name"),
      description: z
        .string()
        .nullable()
        .optional()
        .describe("Description, or null to clear it"),
      isActive: z
        .boolean()
        .optional()
        .describe("Whether the pipeline is active"),
      domainIntegrationId: guidField("Domain integration id").optional(),
      timeout: timeoutField
        .nullable()
        .optional()
        .describe("Run timeout in milliseconds, or null to clear it"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_add_agent_step",
    title: "Add agent step",
    description:
      "Append a step that invokes an active agent. Returns stepId. Input and config are checked against the agent's schemas on update and at run time, not here.",
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/add-step",
    requiresConfirm: false,
    annotations: CREATE_ANNOTATIONS,
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
      agentId: z.string().min(1).describe("Agent id"),
      agentVersion: z.string().min(1).describe("Agent version"),
      agentConfigId: guidField(
        "Saved agent config id. When set, config is ignored.",
      ).optional(),
      agentContractId: guidField("Agent contract id").optional(),
      input: jsonObjectField(
        "Step input. Values may use {{params.<name>}} and data source expressions.",
      ).optional(),
      config: jsonObjectField("Inline agent config").optional(),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_add_pipeline_step",
    title: "Add pipeline step",
    description:
      "Append a step that runs another pipeline of the same domain integration. Returns stepId.",
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/add-pipeline-step",
    requiresConfirm: false,
    annotations: CREATE_ANNOTATIONS,
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
      targetPipelineId: guidField("Id of the pipeline this step runs"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_update_agent_step",
    title: "Update agent step",
    description:
      "Replace an agent step's agent, saved config, contract, input, and config. Omitted input or config become {}. Returns validationWarnings but saves anyway.",
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/update-step",
    requiresConfirm: false,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
      stepId: guidField("Step id"),
      agentId: z.string().min(1).describe("Agent id"),
      agentVersion: z.string().min(1).describe("Agent version"),
      agentConfigId: z
        .guid()
        .nullable()
        .optional()
        .describe("Saved agent config id, or null for inline config"),
      agentContractId: z
        .guid()
        .nullable()
        .optional()
        .describe("Agent contract id, or null for none"),
      input: jsonObjectField("Step input").optional(),
      config: jsonObjectField(
        "Inline agent config. Ignored when agentConfigId is set.",
      ).optional(),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_update_pipeline_step",
    title: "Update pipeline step",
    description:
      "Change which pipeline a pipeline step runs and the input overrides merged into every step of that pipeline.",
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/update-pipeline-step",
    requiresConfirm: false,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
      stepId: guidField("Step id"),
      targetPipelineId: guidField("Id of the pipeline this step runs"),
      input: jsonObjectField(
        "Input overrides, for example { tickerId: '{{params.tickerId}}' }. Use {} for none.",
      ),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_remove_step",
    title: "Remove step",
    description: `Remove a step from a pipeline and renumber the rest. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/remove-step",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
      stepId: guidField("Step id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_reorder_steps",
    title: "Reorder steps",
    description:
      "Set the order of a pipeline's steps. stepIds must list every step id of the pipeline exactly once.",
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/reorder-steps",
    requiresConfirm: false,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
      stepIds: z.array(z.guid()).min(1).describe("Step ids in the new order"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_run_pipeline",
    title: "Run pipeline",
    description: `Enqueue a manual pipeline run. Its agents act on real data. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/run-pipeline",
    requiresConfirm: true,
    annotations: RUN_ANNOTATIONS,
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
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
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/cancel-manual-execution",
    requiresConfirm: true,
    annotations: CANCEL_ANNOTATIONS,
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
      manualExecutionId: guidField("Manual pipeline execution id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_pipeline",
    title: "Delete pipeline",
    description: `Delete a pipeline with its steps, runs, schedules, and triggers. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "pipelines",
    pathTemplate: "/dashboard/pipelines/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { pipelineId: guidField("Pipeline id"), ...confirmField },
  },
];
