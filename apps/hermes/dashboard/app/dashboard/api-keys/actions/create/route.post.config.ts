import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { createApiKey } from "@/lib/mcp-api-keys";

const bodyValidator = z.object({
  label: z.string().min(1, "Label is required"),
  readOnly: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "true"),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
  label: z.string(),
  readOnly: z.boolean(),
  apiKeyPlaintext: z.string(),
});

type CreateMcpApiKeyHandlerDependencies = {
  createKey?: typeof createApiKey;
};

type CreateMcpApiKeyHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates an MCP API key for the current session admin.
 *
 * @param dependencies - Injectable create helper for tests.
 * @returns Handler that returns one-time plaintext key.
 */
export const createCreateMcpApiKeyHandler = ({
  createKey = createApiKey,
}: CreateMcpApiKeyHandlerDependencies = {}): CreateMcpApiKeyHandler => {
  return async (data) => {
    try {
      const result = await createKey({
        label: data.body.label,
        readOnly: data.body.readOnly,
        createdByUserId: data.user.id,
      });
      return successResponse({
        id: result.id,
        label: result.label,
        readOnly: result.readOnly,
        apiKeyPlaintext: result.apiKeyPlaintext,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create API key";
      return errorResponse(message);
    }
  };
};

/** Route handler for creating an MCP API key. */
export const handler: CreateMcpApiKeyHandler = createCreateMcpApiKeyHandler();
