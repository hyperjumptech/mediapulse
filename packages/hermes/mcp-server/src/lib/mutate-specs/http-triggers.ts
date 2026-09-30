import {
  CANCEL_ANNOTATIONS,
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  DELETE_ANNOTATIONS,
  guidField,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

export const HTTP_TRIGGER_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_cancel_http_trigger_execution",
    title: "Cancel HTTP trigger execution",
    description: `Cancel a running HTTP trigger execution. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "triggers",
    pathTemplate: "/dashboard/http-triggers/actions/cancel-execution",
    requiresConfirm: true,
    annotations: CANCEL_ANNOTATIONS,
    inputSchema: {
      httpTriggerId: guidField("HTTP trigger id"),
      httpTriggerExecutionId: guidField("HTTP trigger execution id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_http_trigger",
    title: "Delete HTTP trigger",
    description: `Delete an HTTP trigger. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "triggers",
    pathTemplate: "/dashboard/http-triggers/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: {
      httpTriggerId: guidField("HTTP trigger id"),
      ...confirmField,
    },
  },
];
