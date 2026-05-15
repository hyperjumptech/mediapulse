import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { revokeApiKey } from "@/lib/mcp-api-keys";

const bodyValidator = z.object({
  id: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type RevokeMcpApiKeyHandlerDependencies = {
  revoke?: typeof revokeApiKey;
};

type RevokeMcpApiKeyHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Revokes an MCP API key (any admin may revoke any key).
 *
 * @param dependencies - Injectable revoke helper for tests.
 * @returns Handler that marks the key revoked.
 */
export const createRevokeMcpApiKeyHandler = ({
  revoke = revokeApiKey,
}: RevokeMcpApiKeyHandlerDependencies = {}): RevokeMcpApiKeyHandler => {
  return async (data) => {
    const revoked = await revoke(data.body.id, data.user.id);
    if (!revoked) {
      return errorResponse("API key not found or already revoked");
    }
    return successResponse({ ok: true as const });
  };
};

/** Route handler for revoking an MCP API key. */
export const handler: RevokeMcpApiKeyHandler = createRevokeMcpApiKeyHandler();
