import { z } from "zod";

import {
  CANCEL_ANNOTATIONS,
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  guidField,
  UPDATE_ANNOTATIONS,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

const httpTriggerFields = {
  name: z.string().min(1).describe("Trigger name"),
  description: z.string().optional().describe("Optional description"),
  pipelineId: guidField("Pipeline to run. It must be valid and active."),
  enabled: z.boolean().optional().describe("Whether the trigger accepts calls"),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .describe("HTTP method callers use. Event mode always uses POST."),
  startMode: z
    .enum(["token", "event"])
    .optional()
    .describe(
      "token: callers invoke the URL with bearerToken. event: the domain integration starts it by sending eventName. Default token.",
    ),
  bearerToken: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Token callers must send, required in token mode. Only a hash is stored. It passes through this conversation, so prefer event mode when possible.",
    ),
  eventName: z
    .string()
    .regex(/^[a-z0-9][a-z0-9._-]{0,99}$/)
    .optional()
    .describe(
      "Domain event name, required in event mode, for example day1.full-chain",
    ),
};

export const HTTP_TRIGGER_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_create_http_trigger",
    title: "Create HTTP trigger",
    description:
      "Create a trigger that runs a pipeline when its URL is called with a token, or when the domain integration sends a named event. Returns id.",
    toolset: "triggers",
    pathTemplate: "/dashboard/http-triggers/actions/create",
    requiresConfirm: false,
    annotations: CREATE_ANNOTATIONS,
    inputSchema: { ...httpTriggerFields, ...confirmField },
  },
  {
    name: "hermes_mutate_update_http_trigger",
    title: "Update HTTP trigger",
    description:
      "Change a trigger. Omitted fields keep their value. A new bearerToken replaces the old one, and switching to event mode clears the token.",
    toolset: "triggers",
    pathTemplate: "/dashboard/http-triggers/actions/update",
    requiresConfirm: false,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      httpTriggerId: guidField("HTTP trigger id"),
      name: httpTriggerFields.name.optional(),
      description: httpTriggerFields.description,
      pipelineId: httpTriggerFields.pipelineId.optional(),
      enabled: httpTriggerFields.enabled,
      method: httpTriggerFields.method.optional(),
      startMode: httpTriggerFields.startMode,
      bearerToken: httpTriggerFields.bearerToken,
      eventName: httpTriggerFields.eventName,
      ...confirmField,
    },
  },
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
