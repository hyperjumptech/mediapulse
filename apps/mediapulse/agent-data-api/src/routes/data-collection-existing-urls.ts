import { Context } from "hono";

import { postDataCollectionExistingUrlsBodySchema } from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import type { Prisma } from "@mediapulse/database";
import { prisma } from "@mediapulse/database";

/**
 * Returns which of the given URLs already have a `data_source` row for the ticker (exact URL match).
 *
 * @param context - Hono context; JSON body `{ tickerId, urls }`.
 * @returns JSON `{ existingUrls }` (unique subset of requested URLs found in DB).
 */
export async function postDataCollectionExistingUrls(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postDataCollectionExistingUrlsBodySchema.parseAsync(body);
    const uniqueRequested = [...new Set(parsed.urls)];

    if (uniqueRequested.length === 0) {
      return context.json({ existingUrls: [] }, 200);
    }

    const findArgs = {
      where: {
        tickerId: parsed.tickerId,
        url: { in: uniqueRequested },
      },
      select: { url: true },
    } satisfies Prisma.DataSourceFindManyArgs;

    const rows = await prisma.dataSource.findMany(findArgs);
    const existingUrls = [...new Set(rows.map((row) => row.url))];

    return context.json({ existingUrls }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
