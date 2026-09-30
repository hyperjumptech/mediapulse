import type { HermesReadToolSpec } from "../read-tool-spec.js";

export const ADMIN_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  {
    name: "hermes_list_admins",
    title: "List admins",
    description:
      "Every Hermes dashboard admin with name, email, active flag, and creation time. No passwords.",
    toolset: "admin",
    method: "GET",
    pathTemplate: "/api/admins",
    inputSchema: {},
  },
  {
    name: "hermes_list_api_keys",
    title: "List API keys",
    description:
      "Every active MCP API key with label, readOnly flag, owner, and last use. Never returns the key itself.",
    toolset: "admin",
    method: "GET",
    pathTemplate: "/api/api-keys",
    inputSchema: {},
  },
];
