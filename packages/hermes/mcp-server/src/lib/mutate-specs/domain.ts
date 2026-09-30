import { z } from "zod";

import {
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  CREATE_ANNOTATIONS,
  CREDENTIAL_CONFIRM_SENTENCE,
  CREDENTIAL_CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  guidField,
  payloadFilePathField,
  RUN_ANNOTATIONS,
  secretFilePathField,
  UPDATE_ANNOTATIONS,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

const domainRowTargetFields = {
  integrationId: z.string().min(1).describe("Domain integration id"),
  resource: z
    .string()
    .min(1)
    .describe("View pathSegment from hermes_list_domain_views"),
};

const rowValuesField = z
  .record(z.string(), z.unknown())
  .describe(
    "Row fields, shaped by the view's schema from hermes_get_domain_view",
  );

export const DOMAIN_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_create_domain_integration",
    title: "Create domain integration",
    description: `Create a pending domain integration and return its API key once. The domain service registers itself with that key to become active. Pass secretFilePath to keep the key out of this conversation. ${CREDENTIAL_CONFIRM_SENTENCE}`,
    toolset: "domain",
    pathTemplate: "/dashboard/domain-integrations/actions/create",
    requiresConfirm: true,
    confirmReason: "credential",
    secretFields: ["apiKeyPlaintext"],
    annotations: CREDENTIAL_CREATE_ANNOTATIONS,
    inputSchema: {
      integrationId: z
        .string()
        .min(1)
        .describe("Integration id, used in dashboard URLs, for example acme"),
      name: z.string().min(1).describe("Display name"),
      ...secretFilePathField,
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_domain_integration",
    title: "Delete domain integration",
    description: `Delete a domain integration and its API key. Refused while a pipeline uses it. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "domain",
    pathTemplate: "/dashboard/domain-integrations/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: {
      id: guidField(
        "Domain integration row id from hermes_list_domain_integrations",
      ),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_create_domain_row",
    title: "Create domain row",
    description:
      "Create a row in a resource-table view that allows create. Read the view's createSchema with hermes_get_domain_view first.",
    toolset: "domain",
    pathTemplate: "/dashboard/domain-integrations/actions/create-row",
    requiresConfirm: false,
    annotations: { ...CREATE_ANNOTATIONS, openWorldHint: true },
    inputSchema: {
      ...domainRowTargetFields,
      values: rowValuesField,
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_update_domain_row",
    title: "Update domain row",
    description:
      "Update a row in a resource-table view that allows update, using the view's updateSchema from hermes_get_domain_view.",
    toolset: "domain",
    pathTemplate: "/dashboard/domain-integrations/actions/update-row",
    requiresConfirm: false,
    annotations: { ...UPDATE_ANNOTATIONS, openWorldHint: true },
    inputSchema: {
      ...domainRowTargetFields,
      id: z.string().min(1).describe("Row id"),
      values: rowValuesField,
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_domain_row",
    title: "Delete domain row",
    description: `Delete a row in a resource-table view that allows delete. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "domain",
    pathTemplate: "/dashboard/domain-integrations/actions/delete-row",
    requiresConfirm: true,
    annotations: { ...DELETE_ANNOTATIONS, openWorldHint: true },
    inputSchema: {
      ...domainRowTargetFields,
      id: z.string().min(1).describe("Row id"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_run_domain_action",
    title: "Run domain custom action",
    description: `Run one of a view's customActions. json-file-upload actions import payloadJson (or the file at payloadFilePath). danger-confirm actions, such as deleting every row, run as confirmed. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "domain",
    pathTemplate: "/dashboard/domain-integrations/actions/run-custom-action",
    requiresConfirm: true,
    payloadFileField: "payloadJson",
    annotations: RUN_ANNOTATIONS,
    inputSchema: {
      ...domainRowTargetFields,
      actionId: z
        .string()
        .min(1)
        .describe("Custom action id from hermes_list_domain_views"),
      payloadJson: z
        .string()
        .optional()
        .describe("JSON text to import, for json-file-upload actions"),
      ...payloadFilePathField,
      ...confirmField,
    },
  },
];
