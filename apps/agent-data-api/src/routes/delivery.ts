import { Context } from "hono";

import { internalError, notFound } from "@workspace/api-utils";
import {
  getDeliveryQuerySchema,
  getDeliveryResponseSchema,
  postDeliveryBodySchema,
  postDeliveryResponseSchema,
} from "@workspace/agent-data-api-contract";
import { getDeliveryData, postDelivery } from "../services/delivery.js";

export async function getDelivery(context: Context): Promise<Response> {
  try {
    const query = getDeliveryQuerySchema.parse(context.req.query());
    const result = await getDeliveryData(query.tickerId);
    if (!result) {
      return notFound(context, "No newsletter found for this ticker");
    }
    const response = getDeliveryResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postDeliveryHandler(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postDeliveryBodySchema.parseAsync(body);
    await postDelivery(data);
    const response = postDeliveryResponseSchema.parse({ message: "Success" });
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
