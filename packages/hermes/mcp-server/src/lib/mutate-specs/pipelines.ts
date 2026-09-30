import { z } from "zod";

import {
  CANCEL_ANNOTATIONS,
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  DELETE_ANNOTATIONS,
  guidField,
  RUN_ANNOTATIONS,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

export const PIPELINE_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
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
