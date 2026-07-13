import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  postContentGenerationCitationsBodySchema,
  postContentGenerationCitationsResponseSchema,
} from "@workspace/agent-data-api-contract";

import { createNewsletterCitations } from "../services/newsletter-citation.js";

export async function postContentGenerationCitations(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data =
      await postContentGenerationCitationsBodySchema.parseAsync(body);
    const result = await createNewsletterCitations(data);
    const response = postContentGenerationCitationsResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
