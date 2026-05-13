import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  getContentGenerationQuerySchema,
  getContentGenerationResponseSchema,
  getContentGenerationNewslettersLatestQuerySchema,
  getContentGenerationNewslettersLatestResponseSchema,
  postContentGenerationBodySchema,
  postContentGenerationResponseSchema,
} from "@workspace/agent-data-api-contract";
import {
  createNewsletter,
  getDataSourcesForTicker,
  getLatestNewsletter,
} from "../services/content-generation.js";

export async function getContentGeneration(
  context: Context,
): Promise<Response> {
  try {
    const query = getContentGenerationQuerySchema.parse(context.req.query());
    const result = await getDataSourcesForTicker(query.tickerId);
    const response = getContentGenerationResponseSchema.parse(result);
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

export async function getContentGenerationNewslettersLatest(
  context: Context,
): Promise<Response> {
  try {
    const query = getContentGenerationNewslettersLatestQuerySchema.parse(
      context.req.query(),
    );
    const result = await getLatestNewsletter(
      query.tickerId,
      query.windowStart,
      query.windowEnd,
    );
    const response =
      getContentGenerationNewslettersLatestResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
