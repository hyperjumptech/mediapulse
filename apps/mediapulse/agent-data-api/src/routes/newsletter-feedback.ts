import { Context } from "hono";
import { internalError } from "@workspace/api-utils";
import {
  postNewsletterFeedbackRecordBodySchema,
  postNewsletterFeedbackRecordResponseSchema,
} from "@workspace/agent-data-api-contract";

import { recordNewsletterFeedback } from "../services/newsletter-feedback.js";

export async function postNewsletterFeedbackRecordHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postNewsletterFeedbackRecordBodySchema.parseAsync(body);
    const result = await recordNewsletterFeedback(data);
    const response = postNewsletterFeedbackRecordResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
