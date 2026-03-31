import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  getQueryAnalysisQuerySchema,
  getQueryAnalysisResponseSchema,
  postQueryAnalysisBodySchema,
  postQueryAnalysisResponseSchema,
} from "@workspace/agent-data-api-contract";
import {
  getQueryAnalysisContext,
  createQueryAnalysisSet,
} from "../services/query-analysis.js";

export async function getQueryAnalysis(context: Context): Promise<Response> {
  try {
    const query = getQueryAnalysisQuerySchema.parse(context.req.query());
    const contextData = await getQueryAnalysisContext(query.tickerId);
    const response = getQueryAnalysisResponseSchema.parse(contextData);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postQueryAnalysis(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postQueryAnalysisBodySchema.parseAsync(body);
    const result = await createQueryAnalysisSet(data);
    const response = postQueryAnalysisResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
