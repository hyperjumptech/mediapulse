import { Context } from "hono";

import {
  contentGenerationRunQuerySchema,
  getContentGenerationRunResponseSchema,
  postContentGenerationRunBodySchema,
  postContentGenerationRunResponseSchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";

import {
  createContentGenerationRun,
  listContentGenerationRuns,
} from "../services/content-generation-run.js";

/**
 * GET /content-generation-runs — lists diagnostic runs with optional filters.
 *
 * @param context - Hono request context.
 * @returns Paginated list of content-generation runs, newest first.
 */
export async function getContentGenerationRuns(
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
    const query = contentGenerationRunQuerySchema.parse(normalizedQuery);
    const rowsData = await listContentGenerationRuns({
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.tickerId !== undefined ? { tickerId: query.tickerId } : {}),
      ...(query.outcome !== undefined ? { outcome: query.outcome } : {}),
      ...(query.startTime !== undefined
        ? { startTime: new Date(query.startTime) }
        : {}),
      ...(query.endTime !== undefined
        ? { endTime: new Date(query.endTime) }
        : {}),
    });

    const data = rowsData.data.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      agentVersion: row.agentVersion,
      tickerId: row.tickerId,
      outcome: row.outcome,
      stage: row.stage,
      errorCode: row.errorCode,
      errorCategory: row.errorCategory,
      message: row.message,
      durationMs: row.durationMs,
      pipelineRunId: row.pipelineRunId,
      newsletterId: row.newsletterId,
      createdAt: row.createdAt.toISOString(),
    }));

    const response = getContentGenerationRunResponseSchema.parse({ 
      data, 
      nextCursor: rowsData.nextCursor 
    });
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/**
 * POST /content-generation-runs — creates a diagnostic run record.
 *
 * @param context - Hono request context.
 * @returns The newly created run record including server-generated id and createdAt.
 */
export async function postContentGenerationRun(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postContentGenerationRunBodySchema.parseAsync(body);

    const created = await createContentGenerationRun({
      agentId: data.agentId,
      agentVersion: data.agentVersion,
      tickerId: data.tickerId,
      outcome: data.outcome,
      stage: data.stage ?? null,
      errorCode: data.errorCode ?? null,
      errorCategory: data.errorCategory ?? null,
      message: data.message ?? null,
      durationMs: data.durationMs ?? null,
      pipelineRunId: data.pipelineRunId ?? null,
      newsletterId: data.newsletterId ?? null,
    });

    const response = postContentGenerationRunResponseSchema.parse({
      id: created.id,
      agentId: created.agentId,
      agentVersion: created.agentVersion,
      tickerId: created.tickerId,
      outcome: created.outcome,
      stage: created.stage,
      errorCode: created.errorCode,
      errorCategory: created.errorCategory,
      message: created.message,
      durationMs: created.durationMs,
      pipelineRunId: created.pipelineRunId,
      newsletterId: created.newsletterId,
      createdAt: created.createdAt.toISOString(),
    });

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
