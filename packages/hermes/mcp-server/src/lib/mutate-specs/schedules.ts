import { z } from "zod";

import {
  CANCEL_ANNOTATIONS,
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  guidField,
  jsonObjectField,
  UPDATE_ANNOTATIONS,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

const scheduleFields = {
  name: z.string().min(1).describe("Schedule name"),
  description: z.string().optional().describe("Optional description"),
  repeat: z
    .enum(["once", "repeating"])
    .describe(
      "once runs at startAt. repeating needs cronExpression or interval.",
    ),
  cronExpression: z
    .string()
    .nullable()
    .optional()
    .describe("Cron expression evaluated in timezone, for example 0 2 * * *"),
  interval: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe("Repeat interval in milliseconds, used when there is no cron"),
  timezone: z
    .string()
    .min(1)
    .describe("IANA time zone, for example Asia/Jakarta"),
  startAt: z
    .string()
    .nullable()
    .optional()
    .describe(
      "First run. ISO with offset, or a wall time like 2026-10-01T02:00 read in timezone. Required when repeat is once.",
    ),
  pipelineId: guidField("Pipeline to run. It must be valid and active."),
  retryConfig: jsonObjectField("Retry settings object").nullable().optional(),
  executionConfig: jsonObjectField(
    "Execution overrides: stepRollupPolicy strict or tolerant, stepOrder sequential or parallel, continueSequentialAfterPartial",
  )
    .nullable()
    .optional(),
  priority: z.number().int().optional().describe("Queue priority"),
  enabled: z.boolean().optional().describe("Whether the schedule runs"),
};

export const SCHEDULE_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_create_schedule",
    title: "Create schedule",
    description:
      "Create a schedule that runs a pipeline once or on a cron or interval. Enabled unless enabled is false. Returns id.",
    toolset: "schedules",
    pathTemplate: "/dashboard/schedules/actions/create",
    requiresConfirm: false,
    annotations: CREATE_ANNOTATIONS,
    inputSchema: { ...scheduleFields, ...confirmField },
  },
  {
    name: "hermes_mutate_update_schedule",
    title: "Update schedule",
    description:
      "Change a schedule. Omitted fields keep their value, null clears cronExpression, interval, startAt, retryConfig, or executionConfig. The next run is recomputed.",
    toolset: "schedules",
    pathTemplate: "/dashboard/schedules/actions/update",
    requiresConfirm: false,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      scheduleId: guidField("Schedule id"),
      name: scheduleFields.name.optional(),
      description: scheduleFields.description,
      repeat: scheduleFields.repeat.optional(),
      cronExpression: scheduleFields.cronExpression,
      interval: scheduleFields.interval,
      timezone: scheduleFields.timezone.optional(),
      startAt: scheduleFields.startAt,
      pipelineId: scheduleFields.pipelineId.optional(),
      retryConfig: scheduleFields.retryConfig,
      executionConfig: scheduleFields.executionConfig,
      priority: scheduleFields.priority,
      enabled: scheduleFields.enabled,
      ...confirmField,
    },
  },
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
