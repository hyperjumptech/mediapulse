import { Context } from "hono";
import { internalError } from "@workspace/api-utils";
import {
  getQueryAnalysisQuerySchema,
  getQueryAnalysisResponseSchema,
  postQueryAnalysisBodySchema,
  postQueryAnalysisResponseSchema,
} from "@workspace/agent-data-api-contract";
import {
  createAndActivateQuerySet,
  getQueryAnalysisContext,
} from "../services/query-analysis.js";

/**
 * Returns query generation context for one ticker.
 *
 * @param context - Hono request context.
 * @returns Ticker, top entities, and recent themes.
 */
export async function getQueryAnalysis(context: Context): Promise<Response> {
  try {
    const query = getQueryAnalysisQuerySchema.parse(context.req.query());
    const payload = await getQueryAnalysisContext(query);
    const response = getQueryAnalysisResponseSchema.parse(payload);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/**
 * Persists and activates a versioned query set for a ticker.
 *
 * @param context - Hono request context.
 * @returns Created count and active set ids.
 */
export async function postQueryAnalysis(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postQueryAnalysisBodySchema.parseAsync(body);
    const created = await createAndActivateQuerySet(data);
    const response = postQueryAnalysisResponseSchema.parse(created);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
