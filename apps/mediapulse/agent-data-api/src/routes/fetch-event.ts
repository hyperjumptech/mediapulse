import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  postContentGenerationFetchEventsBodySchema,
  postContentGenerationFetchEventsResponseSchema,
} from "@workspace/agent-data-api-contract";

import { createFetchEvents } from "../services/fetch-event.js";

export async function postContentGenerationFetchEvents(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const items =
      await postContentGenerationFetchEventsBodySchema.parseAsync(body);
    const result = await createFetchEvents(items);
    const response =
      postContentGenerationFetchEventsResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
