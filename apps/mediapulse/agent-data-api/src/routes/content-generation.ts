import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  getContentGenerationQuerySchema,
  getContentGenerationResponseSchema,
  postContentGenerationBodySchema,
  postContentGenerationResponseSchema,
} from "@workspace/agent-data-api-contract";
import {
  createNewsletter,
  getDataSourcesForTicker,
} from "../services/content-generation.js";

export async function getContentGeneration(
  context: Context,
): Promise<Response> {
  try {
    const query = getContentGenerationQuerySchema.parse(context.req.query());
    const dataSources = await getDataSourcesForTicker(query.tickerId);
    const response = getContentGenerationResponseSchema.parse({ dataSources });
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postContentGeneration(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postContentGenerationBodySchema.parseAsync(body);
    await createNewsletter(data);
    const response = postContentGenerationResponseSchema.parse({
      message: "Success",
    });
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
