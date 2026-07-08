import { Context } from "hono";

import {
  postQueryAnalysisRunBodySchema,
  postQueryAnalysisRunResponseSchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";

import { createQueryAnalysisRun } from "../services/query-analysis-run.js";

/**
 * POST /query-analysis-runs — records one query-analysis chronicle run
 * (the per-query include/reject decision log for a single agent run).
 *
 * @param context - Hono request context.
 * @returns The newly created run record including server-generated id and createdAt.
 */
export async function postQueryAnalysisRun(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postQueryAnalysisRunBodySchema.parseAsync(body);

    const created = await createQueryAnalysisRun({
      tickerId: data.tickerId,
      executionId: data.executionId ?? null,
      queries: data.queries,
    });

    const response = postQueryAnalysisRunResponseSchema.parse({
      id: created.id,
      tickerId: created.tickerId,
      executionId: created.executionId,
      queries: created.queries,
      createdAt: created.createdAt.toISOString(),
    });

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
