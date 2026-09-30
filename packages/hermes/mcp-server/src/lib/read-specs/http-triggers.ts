import {
  guidField,
  listToolSpec,
  type HermesReadToolSpec,
} from "../read-tool-spec.js";

export const HTTP_TRIGGER_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  listToolSpec({
    name: "hermes_list_http_triggers",
    title: "List HTTP triggers",
    description: "Page through HTTP triggers with the pipeline each one runs.",
    toolset: "triggers",
    pathTemplate: "/api/http-triggers",
    searchHint: "trigger name and description",
    sortFields: ["name", "created", "enabled", "method"],
    defaultSort: "name asc",
  }),
  {
    name: "hermes_get_http_trigger",
    title: "Get HTTP trigger",
    description:
      "One HTTP trigger with its method, auth type, event name, token hint, and pipeline. The token itself is never returned.",
    toolset: "triggers",
    method: "GET",
    pathTemplate: "/api/http-triggers/{triggerId}",
    inputSchema: { triggerId: guidField("HTTP trigger id") },
  },
  {
    name: "hermes_get_http_trigger_execution",
    title: "Get HTTP trigger execution",
    description:
      "One HTTP trigger execution with its step executions and invocations. Secrets are masked.",
    toolset: "triggers",
    method: "GET",
    pathTemplate: "/api/http-triggers/{triggerId}/executions/{executionId}",
    inputSchema: {
      triggerId: guidField("HTTP trigger id"),
      executionId: guidField("HTTP trigger execution id"),
    },
  },
];
