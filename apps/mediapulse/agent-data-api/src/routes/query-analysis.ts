import { Context } from "hono";

import {
  getQueryAnalysisQuerySchema,
  postQueryAnalysisBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";
import { env } from "@mediapulse/env";

import { getQueryAnalysisContext } from "../services/get-query-analysis-context.js";
import { persistQueryAnalysisSet } from "../services/persist-query-analysis-set.js";

/**
 * Returns query-generation context for a ticker (GET /query-analysis).
 *
 * @param context - Hono context with bearer auth already applied.
 * @returns JSON response or 404 when the ticker is unknown.
 */
export async function getQueryAnalysis(context: Context): Promise<Response> {
  try {
    const query = getQueryAnalysisQuerySchema.parse(context.req.query());
    const data = await getQueryAnalysisContext(prisma, query.tickerId, env);
    if (!data) {
      return context.json({ message: "Ticker not found" }, 404);
    }
    return context.json(data, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/**
 * Persists a versioned query set and optional activation (POST /query-analysis).
 *
 * @param context - Hono context with JSON body.
 * @returns Created counts and set identifiers.
 */
export async function postQueryAnalysis(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postQueryAnalysisBodySchema.parseAsync(body);
    const data = await persistQueryAnalysisSet(prisma, parsed);
    return context.json(data, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "TICKER_NOT_FOUND") {
      return context.json({ message: "Ticker not found" }, 404);
    }
    return internalError(context, error);
  }
}
