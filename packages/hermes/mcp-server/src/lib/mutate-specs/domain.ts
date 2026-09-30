import { z } from "zod";

import {
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  CREDENTIAL_CONFIRM_SENTENCE,
  CREDENTIAL_CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  guidField,
  secretFilePathField,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

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
];
