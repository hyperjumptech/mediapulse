import { Context } from "hono";

import {
  postListingDiscoveryCacheLookupBodySchema,
  postListingDiscoveryCacheRecordBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

import {
  lookupListingDiscoveryCache,
  recordListingDiscoveryCache,
} from "../services/listing-discovery-cache.js";

/**
 * Returns cached discovery entries for the requested listing URLs (non-expired only).
 *
 * @param context - Hono context; JSON body `{ listingUrls }`.
 * @returns JSON `{ entries }`.
 */
export async function postListingDiscoveryCacheLookup(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postListingDiscoveryCacheLookupBodySchema.parseAsync(body);
    const entries = await lookupListingDiscoveryCache(parsed.listingUrls, {
      listingDiscoveryCache: prisma.listingDiscoveryCache,
    });

    return context.json({ entries }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/**
 * Upserts fresh discovery results into the cache with the given TTL.
 *
 * @param context - Hono context; JSON body array of cache record inputs.
 * @returns JSON `{ recorded }`.
 */
export async function postListingDiscoveryCacheRecord(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postListingDiscoveryCacheRecordBodySchema.parseAsync(body);
    const recorded = await recordListingDiscoveryCache(parsed, {
      listingDiscoveryCache: prisma.listingDiscoveryCache,
    });

    return context.json({ recorded }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
