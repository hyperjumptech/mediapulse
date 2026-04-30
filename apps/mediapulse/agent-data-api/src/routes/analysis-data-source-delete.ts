import { Context } from "hono";

import {
  postAnalysisDataSourceDeleteBodySchema,
  postAnalysisDataSourceDeleteResponseSchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";

import { deleteAnalysisDataSource } from "../services/analysis.js";

export async function postAnalysisDataSourceDelete(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postAnalysisDataSourceDeleteBodySchema.parseAsync(body);
    const result = await deleteAnalysisDataSource(data);
    const response = postAnalysisDataSourceDeleteResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
