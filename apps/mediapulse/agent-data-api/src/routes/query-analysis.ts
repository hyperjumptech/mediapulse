import { Context } from "hono";
import {
  getQueryAnalysisQuerySchema,
  getQueryAnalysisResponseSchema,
  postQueryAnalysisBodySchema,
  postQueryAnalysisResponseSchema,
} from "@workspace/agent-data-api-contract";
import { internalError, notFound } from "@workspace/api-utils";
import {
  getQueryAnalysisContext,
  persistQuerySet,
} from "../services/query-analysis.js";

export async function getQueryAnalysis(context: Context): Promise<Response> {
  try {
    const query = getQueryAnalysisQuerySchema.parse(context.req.query());
    const data = await getQueryAnalysisContext(query.tickerId);
    if (!data) {
      return notFound(context, "Ticker not found");
    }
    const response = getQueryAnalysisResponseSchema.parse(data);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postQueryAnalysis(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postQueryAnalysisBodySchema.parseAsync(body);
    const result = await persistQuerySet(data);
    const response = postQueryAnalysisResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
