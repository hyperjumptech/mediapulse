import { z } from "zod";

/** MCP read tool shape compatible with `@hermes/mcp-server` registration. */
export type MediapulseMcpReadToolSpec = {
  name: string;
  description: string;
  method: "GET";
  pathTemplate: string;
  inputSchema: z.ZodRawShape;
};

const optionalPagination = {
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Max items per page (list endpoints)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous list response"),
};

/**
 * Mediapulse operator diagnostics MCP tools (agent-data-api via Hermes dashboard proxy).
 */
export const MEDIAPULSE_CGA_READ_TOOL_SPECS: MediapulseMcpReadToolSpec[] = [
  {
    name: "mediapulse_list_content_generation_runs",
    description:
      "List content-generation diagnostic runs (Mediapulse agent-data-api).",
    method: "GET",
    pathTemplate: "/api/agents/content-generation-runs",
    inputSchema: {
      ...optionalPagination,
      outcome: z
        .enum(["success", "skipped", "failed"])
        .optional()
        .describe("Filter by run outcome"),
      tickerId: z.string().optional().describe("Filter by ticker id"),
    },
  },
  {
    name: "mediapulse_get_content_generation_run",
    description: "Get a single content-generation diagnostic run by id.",
    method: "GET",
    pathTemplate: "/api/agents/content-generation-runs/{id}",
    inputSchema: {
      id: z.string().uuid().describe("Content-generation run id"),
    },
  },
];
