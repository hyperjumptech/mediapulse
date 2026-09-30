import { z } from "zod";

import {
  CONFIRM_FIRST_SENTENCE,
  confirmField,
  CREDENTIAL_CONFIRM_SENTENCE,
  CREDENTIAL_CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  guidField,
  secretFilePathField,
  UPDATE_ANNOTATIONS,
  type HermesMutateToolSpec,
} from "../mutate-tool-spec.js";

const passwordField = z
  .string()
  .min(4)
  .describe(
    "Password, at least 4 characters. It passes through this conversation.",
  );

export const ADMIN_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  {
    name: "hermes_mutate_create_admin",
    title: "Create admin",
    description: `Create a Hermes dashboard admin who can sign in and issue API keys. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "admin",
    pathTemplate: "/dashboard/admins/actions/create",
    requiresConfirm: true,
    confirmReason: "credential",
    annotations: CREDENTIAL_CREATE_ANNOTATIONS,
    inputSchema: {
      name: z.string().min(1).describe("Display name"),
      email: z.email().describe("Sign-in email"),
      password: passwordField,
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_delete_admin",
    title: "Delete admin",
    description: `Delete a dashboard admin, which also disables their API keys. You cannot delete yourself or the last admin. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "admin",
    pathTemplate: "/dashboard/admins/actions/delete",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { id: guidField("Admin user id"), ...confirmField },
  },
  {
    name: "hermes_mutate_reset_admin_password",
    title: "Reset admin password",
    description: `Set a new password for an admin. It signs them out everywhere and stops their API keys. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "admin",
    pathTemplate: "/dashboard/admins/actions/reset-password",
    requiresConfirm: true,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      id: guidField("Admin user id"),
      newPassword: passwordField,
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_set_admin_active",
    title: "Enable or disable admin",
    description: `Enable or disable an admin. A disabled admin cannot sign in and their API keys stop working. You cannot disable yourself or the last active admin. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "admin",
    pathTemplate: "/dashboard/admins/actions/set-active",
    requiresConfirm: true,
    annotations: UPDATE_ANNOTATIONS,
    inputSchema: {
      id: guidField("Admin user id"),
      active: z.boolean().describe("true to enable, false to disable"),
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_create_api_key",
    title: "Create API key",
    description: `Issue an MCP API key owned by the calling key's admin and return it once. Pass secretFilePath to keep it out of this conversation. ${CREDENTIAL_CONFIRM_SENTENCE}`,
    toolset: "admin",
    pathTemplate: "/dashboard/api-keys/actions/create",
    requiresConfirm: true,
    confirmReason: "credential",
    secretFields: ["apiKeyPlaintext"],
    annotations: CREDENTIAL_CREATE_ANNOTATIONS,
    inputSchema: {
      label: z.string().min(1).describe("Label shown on the API keys page"),
      readOnly: z
        .boolean()
        .describe("true for a key that can only call read tools"),
      ...secretFilePathField,
      ...confirmField,
    },
  },
  {
    name: "hermes_mutate_revoke_api_key",
    title: "Revoke API key",
    description: `Revoke an MCP API key. Revoking the key this server uses ends its access. ${CONFIRM_FIRST_SENTENCE}`,
    toolset: "admin",
    pathTemplate: "/dashboard/api-keys/actions/revoke",
    requiresConfirm: true,
    annotations: DELETE_ANNOTATIONS,
    inputSchema: { id: guidField("API key id"), ...confirmField },
  },
];
