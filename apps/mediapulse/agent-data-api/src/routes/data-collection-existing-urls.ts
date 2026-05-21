import { Context } from "hono";

import { postDataCollectionExistingUrlsBodySchema } from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import type { Prisma } from "@mediapulse/database";
import { prisma } from "@mediapulse/database";

import { getDataSourceHostCountsForTicker } from "../services/data-source-host-counts.js";

/**
 * Returns which of the given URLs already have a `data_source` row for the ticker (exact URL match).
 *
 * @param context - Hono context; JSON body `{ tickerId, urls }`.
 * @returns JSON `{ existingUrls, hostCounts }`.
 */
export async function postDataCollectionExistingUrls(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postDataCollectionExistingUrlsBodySchema.parseAsync(body);
    const hostCounts = await getDataSourceHostCountsForTicker(parsed.tickerId);
    const uniqueRequested = [...new Set(parsed.urls)];

    if (uniqueRequested.length === 0) {
      return context.json({ existingUrls: [], hostCounts }, 200);
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

    return context.json({ existingUrls, hostCounts }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
