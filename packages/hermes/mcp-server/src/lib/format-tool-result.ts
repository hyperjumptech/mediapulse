import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { HermesHttpResponse } from "./http-client.js";

/**
 * Formats an Hermes HTTP response as MCP tool content (JSON text).
 * Non-success HTTP statuses are marked as tool errors so the model sees Hermes error bodies.
 *
 * @param response - Hermes HTTP response from the client.
 * @returns MCP tool result with JSON text content.
 */
export const formatHermesHttpAsToolResult = (
  response: HermesHttpResponse,
): CallToolResult => {
  const payload = {
    status: response.status,
    body: response.body,
  };
  const text = JSON.stringify(payload, null, 2);
  const isError = response.status === 0 || response.status >= 400;

  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {}),
  };
};

/**
 * Formats a client-side tool error (no Hermes HTTP call).
 *
 * @param message - Human-readable error for the model.
 * @param details - Optional structured details (never includes API keys).
 * @returns MCP tool error result.
 */
export const formatHermesToolError = (
  message: string,
  details?: unknown,
): CallToolResult => {
  const payload =
    details === undefined ? { error: message } : { error: message, details };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: true,
  };
};
