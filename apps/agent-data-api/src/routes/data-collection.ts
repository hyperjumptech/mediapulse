import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  getDataCollectionQuerySchema,
  postDataCollectionBodySchema,
} from "../schemas/data-collection.js";
import {
  createDataSources,
  getSearchQueries,
} from "../services/data-collection.js";

export async function getDataCollection(context: Context): Promise<Response> {
  try {
    const query = getDataCollectionQuerySchema.parse(context.req.query());
    const searchQueries = await getSearchQueries(query);
    return context.json({ searchQueries }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postDataCollection(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postDataCollectionBodySchema.parseAsync(body);
    await createDataSources(data);
    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
