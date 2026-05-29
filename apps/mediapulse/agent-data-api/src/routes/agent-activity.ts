import { Context } from "hono";

import {
  getAgentActivityQuerySchema,
  getAgentActivityResponseSchema,
  postAgentActivityBodySchema,
  postAgentActivityResponseSchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";

import {
  getAgentActivityService,
  postAgentActivityService,
} from "../services/agent-activity.js";

/**
 * GET /agent-activity — lists activity rows for a job, oldest first.
 *
 * @param context - Hono request context.
 * @returns Activity rows for the requested `jobId`.
 */
export async function getAgentActivity(context: Context): Promise<Response> {
  try {
    const rawQuery = context.req.query();
    const normalizedQuery = Object.fromEntries(
      Object.entries(rawQuery).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    );
    const query = getAgentActivityQuerySchema.parse(normalizedQuery);
    const rows = await getAgentActivityService(query.jobId);

    const data = rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      title: row.title,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));

    const response = getAgentActivityResponseSchema.parse({ data });
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/**
 * POST /agent-activity — records one activity heartbeat for a job.
 *
 * @param context - Hono request context.
 * @returns The server-generated row id.
 */
export async function postAgentActivity(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postAgentActivityBodySchema.parseAsync(body);

    const created = await postAgentActivityService({
      jobId: data.jobId,
      title: data.title,
      description: data.description,
      status: data.status,
    });

    const response = postAgentActivityResponseSchema.parse(created);
    return context.json(response, 201);
  } catch (error) {
    return internalError(context, error);
  }
}
