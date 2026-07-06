import { Context } from "hono";

import {
  postTickerDiscoveryLookupBodySchema,
  postTickerDiscoveryRecordBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

import {
  lookupTickerDiscovery,
  recordTickerDiscovery,
} from "../services/ticker-discovery.js";

/**
 * Returns the cached discovery entry for a ticker (non-expired only), or `null`.
 *
 * @param context - Hono context; JSON body `{ tickerId }`.
 * @returns JSON `{ entry }`.
 */
export async function postTickerDiscoveryLookup(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postTickerDiscoveryLookupBodySchema.parseAsync(body);
    const entry = await lookupTickerDiscovery(parsed, {
      tickerDiscovery: prisma.tickerDiscovery,
    });

    return context.json({ entry }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/**
 * Upserts fresh discovery results for a ticker with the given TTL.
 *
 * @param context - Hono context; JSON body with competitors, regulators, model, and TTL.
 * @returns JSON `{ tickerId, expiresAt }`.
 */
export async function postTickerDiscoveryRecord(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postTickerDiscoveryRecordBodySchema.parseAsync(body);
    const result = await recordTickerDiscovery(parsed, {
      tickerDiscovery: prisma.tickerDiscovery,
    });

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
