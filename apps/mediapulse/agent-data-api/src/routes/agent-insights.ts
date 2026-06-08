import {
  getAgentInsightsQuerySchema,
  insightsPayloadSchema,
} from "@workspace/agent-data-api-contract";
import { internalError, notFound } from "@workspace/api-utils";
import type { Context } from "hono";

import { resolveInsightsProvider } from "../services/agent-insights-registry.js";

/**
 * Returns an insights payload for a registered agent.
 *
 * @param context - Hono request context; query params `agentId`, `window`, and optional `tickerId`.
 * @returns Parsed `InsightsPayload` or 404 when no provider is registered for `agentId`.
 */
export const getAgentInsights = async (context: Context): Promise<Response> => {
  try {
    const query = getAgentInsightsQuerySchema.parse(context.req.query());
    const provider = resolveInsightsProvider(query.agentId);

    if (!provider) {
      return notFound(
        context,
        `No insights provider registered for agent: ${query.agentId}`,
      );
    }

    const payload = await provider.compute({
      window: query.window,
      tickerId: query.tickerId,
    });

    const response = insightsPayloadSchema.parse(payload);

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
};
