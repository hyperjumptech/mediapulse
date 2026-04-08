import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  getAnalysisQuerySchema,
  getAnalysisResponseSchema,
  postAnalysisBodySchema,
  postAnalysisResponseSchema,
} from "@workspace/agent-data-api-contract";

import {
  AnalysisPostValidationError,
  applyAnalysisPost,
  loadAnalysisContext,
} from "../services/analysis.js";

export async function getAnalysis(context: Context): Promise<Response> {
  try {
    const query = getAnalysisQuerySchema.parse(context.req.query());
    const data = await loadAnalysisContext(query);
    const response = getAnalysisResponseSchema.parse(data);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postAnalysis(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postAnalysisBodySchema.parseAsync(body);
    const result = await applyAnalysisPost(data);
    const response = postAnalysisResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    if (error instanceof AnalysisPostValidationError) {
      return context.json({ error: error.message }, 400);
    }
    return internalError(context, error);
  }
}
