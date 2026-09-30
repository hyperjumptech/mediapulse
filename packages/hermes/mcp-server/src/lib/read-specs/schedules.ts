import {
  guidField,
  listToolSpec,
  type HermesReadToolSpec,
} from "../read-tool-spec.js";

export const SCHEDULE_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  listToolSpec({
    name: "hermes_list_schedules",
    title: "List schedules",
    description: "Page through schedules with the pipeline each one runs.",
    toolset: "schedules",
    pathTemplate: "/api/schedules",
    searchHint: "schedule name and description",
    sortFields: ["name", "nextRunAt", "created", "enabled"],
    defaultSort: "name asc",
  }),
  {
    name: "hermes_get_schedule",
    title: "Get schedule",
    description:
      "One schedule with its cadence, next run, missed-run count, and pipeline.",
    toolset: "schedules",
    method: "GET",
    pathTemplate: "/api/schedules/{scheduleId}",
    inputSchema: { scheduleId: guidField("Schedule id") },
  },
  {
    name: "hermes_get_schedule_execution",
    title: "Get schedule execution",
    description:
      "One schedule execution with its step executions and invocations. Secrets are masked.",
    toolset: "schedules",
    method: "GET",
    pathTemplate: "/api/schedules/{scheduleId}/executions/{executionId}",
    inputSchema: {
      scheduleId: guidField("Schedule id"),
      executionId: guidField("Schedule execution id"),
    },
  },
];
