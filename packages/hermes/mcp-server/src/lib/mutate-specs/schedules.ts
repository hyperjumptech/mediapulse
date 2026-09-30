import {
  CANCEL_ANNOTATIONS,
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  DELETE_ANNOTATIONS,
  guidField,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

export const SCHEDULE_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_cancel_schedule_execution",
    title: "Cancel schedule execution",
    description: `Cancel a running schedule execution. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "schedules",
    pathTemplate: "/dashboard/schedules/actions/cancel-execution",
    requiresConfirm: true,
    annotations: CANCEL_ANNOTATIONS,
    inputSchema: {
      scheduleId: guidField("Schedule id"),
      scheduleExecutionId: guidField("Schedule execution id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_schedule",
    title: "Delete schedule",
    description: `Delete a schedule and its executions. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "schedules",
    pathTemplate: "/dashboard/schedules/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { scheduleId: guidField("Schedule id"), ...confirmField },
  },
];
