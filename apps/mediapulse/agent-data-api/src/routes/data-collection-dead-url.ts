import { Context } from "hono";

import {
  postDataCollectionDeadUrlsLookupBodySchema,
  postDataCollectionDeadUrlsRecordBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

import {
  lookupDeadUrls,
  recordDeadUrls,
} from "../services/data-collection-dead-url.js";

/**
 * Returns which of the given URLs are currently cached as dead for the ticker.
 *
 * @param context - Hono context; JSON body `{ tickerId, urls }`.
 * @returns JSON `{ deadUrls }`.
 */
export async function postDataCollectionDeadUrlsLookup(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postDataCollectionDeadUrlsLookupBodySchema.parseAsync(body);
    const deadUrls = await lookupDeadUrls(
      parsed.tickerId,
      parsed.urls,
      prisma.deadUrl,
    );

    return context.json({ deadUrls }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/**
 * Persists or refreshes dead URLs that match the negative-cache policy.
 *
 * @param context - Hono context; JSON body array of dead URL records.
 * @returns JSON `{ message, recordedCount }`.
 */
export async function postDataCollectionDeadUrlsRecord(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postDataCollectionDeadUrlsRecordBodySchema.parseAsync(body);
    const recordedCount = await recordDeadUrls(parsed, {
      deadUrl: prisma.deadUrl,
    });

    return context.json(
      {
        message: "Dead URLs recorded",
        recordedCount,
      },
      200,
    );
  } catch (error) {
    return internalError(context, error);
  }
}
