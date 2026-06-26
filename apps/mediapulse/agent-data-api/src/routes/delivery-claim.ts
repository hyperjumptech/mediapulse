import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  deliveryClaimBodySchema,
  postDeliveryClaimResponseSchema,
  postDeliveryClaimReleaseResponseSchema,
} from "@workspace/agent-data-api-contract";
import {
  claimDelivery,
  releaseDeliveryClaim,
} from "../services/delivery-claim.js";

export async function postDeliveryClaimHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await deliveryClaimBodySchema.parseAsync(body);
    const result = await claimDelivery(data);
    const response = postDeliveryClaimResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postDeliveryClaimReleaseHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await deliveryClaimBodySchema.parseAsync(body);
    const result = await releaseDeliveryClaim(data);
    const response = postDeliveryClaimReleaseResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
