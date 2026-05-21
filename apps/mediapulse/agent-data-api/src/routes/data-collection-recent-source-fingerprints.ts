import { Context } from "hono";

import { getDataCollectionRecentSourceFingerprintsQuerySchema } from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

import { getRecentSourceFingerprints } from "../services/data-collection-fingerprints.js";

/**
 * Returns recent corpus fingerprints (title + head snippet) for semantic dedupe.
 *
 * @param context - Hono context; query `{ tickerId, windowDays? }`.
 * @returns JSON `{ fingerprints }`.
 */
export async function getDataCollectionRecentSourceFingerprints(
  context: Context,
): Promise<Response> {
  try {
    const query = getDataCollectionRecentSourceFingerprintsQuerySchema.parse(
      context.req.query(),
    );
    const fingerprints = await getRecentSourceFingerprints(
      { tickerId: query.tickerId, windowDays: query.windowDays },
      { dataSource: prisma.dataSource },
    );

    return context.json({ fingerprints }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
