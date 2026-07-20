import {
  getTickerRelevanceTermsQuerySchema,
  getTickerRelevanceTermsResponseSchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import type { Context } from "hono";

import { getTickerRelevanceTermsForAgent } from "../services/ticker-relevance-terms.js";

/**
 * Returns relevance-matching terms for every active ticker.
 *
 * @param context - Hono request context.
 * @returns Per-ticker term lists for relevance matching.
 */
export const getTickerRelevanceTerms = async (
  context: Context,
): Promise<Response> => {
  try {
    getTickerRelevanceTermsQuerySchema.parse(context.req.query());
    const payload = await getTickerRelevanceTermsForAgent();
    const response = getTickerRelevanceTermsResponseSchema.parse(payload);

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
};
