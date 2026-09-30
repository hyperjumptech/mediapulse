import {
  guidField,
  listToolSpec,
  type HermesReadToolSpec,
} from "../read-tool-spec.js";

export const PIPELINE_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  listToolSpec({
    name: "hermes_list_pipelines",
    title: "List pipelines",
    description:
      "Page through pipeline summaries (id, name, description, isActive, stepCount, updatedAt). Use hermes_get_pipeline for steps.",
    toolset: "pipelines",
    pathTemplate: "/api/pipelines",
    searchHint: "pipeline name and description",
    sortFields: ["name", "updated"],
    defaultSort: "updated desc",
  }),
  {
    name: "hermes_get_pipeline",
    title: "Get pipeline",
    description:
      "One pipeline with its ordered steps. An agent step has its agent, input, and config. A pipeline step (kind pipeline) has targetPipelineId and input overrides merged into every step of that pipeline at run time.",
    toolset: "pipelines",
    method: "GET",
    pathTemplate: "/api/pipelines/{pipelineId}",
    inputSchema: { pipelineId: guidField("Pipeline id") },
  },
  {
    name: "hermes_get_pipeline_schemas",
    title: "Get pipeline step schemas",
    description:
      "Input and config JSON schemas of the agent behind each agent step. Pipeline steps return kind pipeline, their targetPipelineId, and null schemas.",
    toolset: "pipelines",
    method: "GET",
    pathTemplate: "/api/pipelines/{pipelineId}/schemas",
    inputSchema: { pipelineId: guidField("Pipeline id") },
  },
  {
    name: "hermes_get_pipeline_execution",
    title: "Get manual pipeline run",
    description:
      "One manual pipeline execution with its step executions and invocations. Secrets are masked.",
    toolset: "pipelines",
    method: "GET",
    pathTemplate: "/api/pipelines/{pipelineId}/executions/{executionId}",
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
      executionId: guidField("Manual pipeline execution id"),
    },
  },
];
