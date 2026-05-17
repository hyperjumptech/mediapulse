import type { HermesHttpClient } from "./http-client.js";
import { formatHermesToolError } from "./format-tool-result.js";

/** Parsed whoami fields used before mutation HTTP calls. */
export type HermesWhoamiSnapshot = {
  readOnly: boolean;
};

/**
 * Parses the whoami JSON body for the read-only flag.
 *
 * @param body - Response body from GET `/api/mcp/whoami`.
 * @returns Read-only flag when present; otherwise null.
 */
export const parseWhoamiReadOnly = (body: unknown): boolean | null => {
  if (typeof body !== "object" || body === null || !("readOnly" in body)) {
    return null;
  }
  return Boolean((body as { readOnly: unknown }).readOnly);
};

/**
 * Returns true when the HTTP body is Hermes read-only key rejection.
 *
 * @param status - HTTP status code.
 * @param body - Parsed response body.
 * @returns Whether the response is a read-only API key error.
 */
export const isReadOnlyKeyHttpResponse = (
  status: number,
  body: unknown,
): boolean => {
  if (status !== 403 || typeof body !== "object" || body === null) {
    return false;
  }
  const record = body as { code?: unknown };
  return record.code === "read_only_key";
};

export type AssertMutationAllowedDependencies = {
  httpClient: HermesHttpClient;
};

/**
 * Verifies the active API key may call mutation routes (whoami, read-only check).
 *
 * @param dependencies - HTTP client for whoami.
 * @returns Success or a formatted MCP tool error result (no HTTP mutation yet).
 */
export const assertMutationAllowed = async ({
  httpClient,
}: AssertMutationAllowedDependencies) => {
  const whoami = await httpClient.request({
    method: "GET",
    path: "/api/mcp/whoami",
  });

  if (isReadOnlyKeyHttpResponse(whoami.status, whoami.body)) {
    return formatHermesToolError(
      "Read-only API key cannot call mutation tools. Create a full-access key in Hermes → API keys.",
    );
  }

  if (whoami.status === 401 || whoami.status === 403) {
    return formatHermesToolError(
      "API key rejected by Hermes. Check the profile API key and base URL.",
      whoami.body,
    );
  }

  if (whoami.status < 200 || whoami.status >= 300) {
    return formatHermesToolError(
      `whoami failed with HTTP ${whoami.status}`,
      whoami.body,
    );
  }

  const readOnly = parseWhoamiReadOnly(whoami.body);
  if (readOnly === true) {
    return formatHermesToolError(
      "Read-only API key cannot call mutation tools. Create a full-access key in Hermes → API keys.",
    );
  }

  return { allowed: true as const };
};
