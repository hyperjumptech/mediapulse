import type { Context } from "hono";
import { internalError } from "@workspace/api-utils";
import {
  getSectionCoverageRollupQuerySchema,
  getSectionCoverageRollupResponseSchema,
} from "@workspace/agent-data-api-contract";

import { getSectionCoverageRollup } from "../services/section-coverage-rollup.js";

/**
 * GET /section-coverage-rollup — returns per-section average coverage and fill grouped by
 * contract version over a rolling window.
 *
 * @param context - Hono request context.
 * @returns Rollup rows sorted by contract version (nulls last).
 */
export async function getSectionCoverageRollupHandler(
  context: Context,
): Promise<Response> {
  try {
    const rawQuery = context.req.query();
    const normalizedQuery = Object.fromEntries(
      Object.entries(rawQuery).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    );
    const query = getSectionCoverageRollupQuerySchema.parse(normalizedQuery);

    const rollupRows = await getSectionCoverageRollup({
      tickerId: query.tickerId,
      windowDays: query.windowDays,
    });

    const response = getSectionCoverageRollupResponseSchema.parse({
      byVersion: rollupRows,
    });

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
