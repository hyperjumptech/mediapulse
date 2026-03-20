import { Context } from "hono";

import { internalError, notFound } from "@workspace/api-utils";
import {
  getQueryAnalysisQuerySchema,
  getQueryAnalysisResponseSchema,
  postQueryAnalysisBodySchema,
  postQueryAnalysisResponseSchema,
} from "../schemas/query-analysis.js";
import {
  createSearchQueries,
  getQueryAnalysisData,
} from "../services/query-analysis.js";

export async function getQueryAnalysis(context: Context): Promise<Response> {
  try {
    const query = getQueryAnalysisQuerySchema.parse(context.req.query());
    const result = await getQueryAnalysisData(query.tickerId);
    const response = getQueryAnalysisResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(context, error.message);
    }
    return internalError(context, error);
  }
}

export async function postQueryAnalysis(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postQueryAnalysisBodySchema.parseAsync(body);
    const result = await createSearchQueries(data);
    const response = postQueryAnalysisResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
