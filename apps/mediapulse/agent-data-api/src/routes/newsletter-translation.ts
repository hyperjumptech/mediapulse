import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  postNewsletterTranslationBodySchema,
  postNewsletterTranslationResponseSchema,
} from "@workspace/agent-data-api-contract";
import { createNewsletterTranslation } from "../services/newsletter-translation.js";

export async function postNewsletterTranslationHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postNewsletterTranslationBodySchema.parseAsync(body);
    await createNewsletterTranslation(data);
    const response = postNewsletterTranslationResponseSchema.parse({
      message: "Success",
    });
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
