import { z } from "zod";

import {
  guidField,
  listToolSpec,
  pagedToolSpec,
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
  pagedToolSpec({
    name: "hermes_list_schedule_executions",
    title: "List schedule executions",
    description: "Page through a schedule's executions, newest first.",
    toolset: "schedules",
    pathTemplate: "/api/schedules/{scheduleId}/executions",
    inputSchema: { scheduleId: guidField("Schedule id") },
  }),
  pagedToolSpec({
    name: "hermes_list_processed_urls",
    title: "List processed URLs",
    description:
      "Page through the URLs a schedule execution's agents collected, dropped, or failed, as reported by its domain integration.",
    toolset: "schedules",
    pathTemplate:
      "/api/schedules/{scheduleId}/executions/{executionId}/processed-urls",
    inputSchema: {
      scheduleId: guidField("Schedule id"),
      executionId: guidField("Schedule execution id"),
      subjectId: z
        .string()
        .min(1)
        .optional()
        .describe("Only URLs for this subject id"),
      agent: z
        .string()
        .min(1)
        .optional()
        .describe("Only URLs from this agent id"),
      status: z
        .enum(["collected", "dropped", "failed"])
        .optional()
        .describe("Outcome filter"),
      gateStatus: z
        .enum(["passed", "failed"])
        .optional()
        .describe("Relevance gate filter"),
    },
    filterQueryKeys: ["subjectId", "agent", "status", "gateStatus"],
    defaultPageSize: 50,
  }),
];
