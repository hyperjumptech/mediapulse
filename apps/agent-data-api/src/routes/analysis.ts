import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  getAnalysisQuerySchema,
  getAnalysisResponseSchema,
  postAnalysisBodySchema,
  postAnalysisResponseSchema,
} from "../schemas/analysis.js";
import { getAnalysisData, saveAnalysisData } from "../services/analysis.js";

export async function getAnalysis(context: Context): Promise<Response> {
  try {
    const query = getAnalysisQuerySchema.parse(context.req.query());
    const result = await getAnalysisData(query.tickerId, query.unanalyzed);
    const response = getAnalysisResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postAnalysis(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postAnalysisBodySchema.parseAsync(body);
    const result = await saveAnalysisData(data);
    const response = postAnalysisResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
