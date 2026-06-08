import { Context } from "hono";

import {
  postDiscoverySourceHealthRecordBodySchema,
  postDiscoverySourceHealthGetBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

import {
  recordDiscoverySourceHealth,
  getDiscoverySourceHealth,
} from "../services/discovery-source-health.js";

/**
 * Upserts per-source daily discovery health rows.
 *
 * @param context - Hono context; JSON body array of health record inputs.
 * @returns JSON `{ recorded }`.
 */
export async function postDiscoverySourceHealthRecord(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postDiscoverySourceHealthRecordBodySchema.parseAsync(body);
    const recorded = await recordDiscoverySourceHealth(parsed, {
      discoverySourceHealth: prisma.discoverySourceHealth,
    });

    return context.json({ recorded }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/**
 * Returns per-source discovery health entries with derived failure signals.
 *
 * @param context - Hono context; JSON body `{ listingUrls, windowDays }`.
 * @returns JSON array of health entries.
 */
export async function postDiscoverySourceHealthGet(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postDiscoverySourceHealthGetBodySchema.parseAsync(body);
    const entries = await getDiscoverySourceHealth(parsed, {
      discoverySourceHealth: prisma.discoverySourceHealth,
    });

    return context.json(entries, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
