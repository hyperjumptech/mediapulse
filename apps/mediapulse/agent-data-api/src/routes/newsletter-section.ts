import { Context } from "hono";

import { internalError } from "@workspace/api-utils";
import {
  postContentGenerationSectionsBodySchema,
  postContentGenerationSectionsResponseSchema,
} from "@workspace/agent-data-api-contract";

import { createNewsletterSections } from "../services/newsletter-section.js";

export async function postContentGenerationSections(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postContentGenerationSectionsBodySchema.parseAsync(body);
    const result = await createNewsletterSections(data);
    const response = postContentGenerationSectionsResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
