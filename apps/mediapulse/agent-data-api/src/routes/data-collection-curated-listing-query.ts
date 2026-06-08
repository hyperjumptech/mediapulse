import { postCuratedListingQueryBodySchema } from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";
import type { Context } from "hono";

import { ensureCuratedListingQuery } from "../services/data-collection-curated-query.js";

/**
 * Returns the stable curated-listing SearchQuery id for a ticker, creating it if absent.
 *
 * @param context - Hono context; JSON body `{ tickerId }`.
 * @returns JSON `{ searchQueryId }`.
 */
export async function postDataCollectionCuratedListingQuery(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = postCuratedListingQueryBodySchema.parse(body);
    const searchQueryId = await ensureCuratedListingQuery(
      parsed.tickerId,
      prisma.searchQuery,
    );

    return context.json({ searchQueryId }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
