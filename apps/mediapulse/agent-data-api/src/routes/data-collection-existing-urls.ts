import { Context } from "hono";

import { postDataCollectionExistingUrlsBodySchema } from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import type { Prisma } from "@mediapulse/database";
import { prisma } from "@mediapulse/database";
import { canonicalizeUrl } from "@workspace/utils";

import { getDataSourceHostCountsForTicker } from "../services/data-source-host-counts.js";

/**
 * Returns which of the given URLs already have a `data_source` row for the ticker.
 *
 * - Important: matching is on the canonical URL, so a row stored under a different scheme, a `www.`
 *   host or a stripped query parameter still counts as present.
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

    const requestedByCanonical = new Map<string, string[]>();
    for (const url of uniqueRequested) {
      let canonical: string;
      try {
        canonical = canonicalizeUrl(url);
      } catch {
        canonical = url;
      }
      const bucket = requestedByCanonical.get(canonical) ?? [];
      bucket.push(url);
      requestedByCanonical.set(canonical, bucket);
    }

    const findArgs = {
      where: {
        tickerId: parsed.tickerId,
        canonicalUrl: { in: [...requestedByCanonical.keys()] },
      },
      select: { canonicalUrl: true },
    } satisfies Prisma.DataSourceFindManyArgs;

    const rows = await prisma.dataSource.findMany(findArgs);
    const existingUrls = [
      ...new Set(
        rows.flatMap((row) => requestedByCanonical.get(row.canonicalUrl) ?? []),
      ),
    ];

    return context.json({ existingUrls, hostCounts }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
