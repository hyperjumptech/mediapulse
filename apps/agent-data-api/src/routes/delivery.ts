import { Context } from "hono";

import { internalError, notFound } from "@workspace/api-utils";
import {
  getDeliveryQuerySchema,
  postDeliveryBodySchema,
} from "../schemas/delivery.js";
import { getDeliveryData, postDelivery } from "../services/delivery.js";

export async function getDelivery(context: Context): Promise<Response> {
  try {
    const query = getDeliveryQuerySchema.parse(context.req.query());
    const result = await getDeliveryData(query.tickerId);
    if (!result) {
      return notFound(context, "No newsletter found for this ticker");
    }
    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postDeliveryHandler(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postDeliveryBodySchema.parseAsync(body);
    await postDelivery(data);
    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
