import {
  getTickerQuerySchema,
  getTickerResponseSchema,
} from "@workspace/agent-data-api-contract";
import { internalError, notFound } from "@workspace/api-utils";
import type { Context } from "hono";

import { getTickerForAgent } from "../services/ticker.js";

/**
 * Returns ticker identity and aliases for one ticker id.
 *
 * @param context - Hono request context.
 * @returns Ticker symbol, name, and alias list for relevance matching.
 */
export const getTicker = async (context: Context): Promise<Response> => {
  try {
    const query = getTickerQuerySchema.parse(context.req.query());
    const payload = await getTickerForAgent(query.tickerId);

    if (!payload) {
      return notFound(context, "Ticker not found");
    }

    const response = getTickerResponseSchema.parse(payload);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
};
