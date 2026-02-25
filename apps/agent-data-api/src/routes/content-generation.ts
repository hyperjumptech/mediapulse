import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  getContentGenerationQuerySchema,
  postContentGenerationBodySchema,
} from "../schemas/content-generation.js";
import {
  createNewsletter,
  getDataSourcesForTicker,
} from "../services/content-generation.js";

export async function getContentGeneration(context: Context) {
  try {
    const query = getContentGenerationQuerySchema.parse(context.req.query());
    const dataSources = await getDataSourcesForTicker(query.tickerId);
    return context.json({ dataSources }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postContentGeneration(context: Context) {
  try {
    const body = await context.req.json();
    const data = await postContentGenerationBodySchema.parseAsync(body);
    await createNewsletter(data);
    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
