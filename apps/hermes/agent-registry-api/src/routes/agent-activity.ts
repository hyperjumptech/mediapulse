import { Context } from "hono";
import { z } from "zod";
import { validateBody } from "@workspace/api-utils";

import { postAgentActivity as postAgentActivityService } from "../services/post-agent-activity";

const postAgentActivityBodySchema = z.object({
  jobId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  status: z.enum(["processing", "completed"]),
});

/**
 * POST /agent-activity — records one activity heartbeat for a Hermes job.
 *
 * Prior rows still marked `processing` for the same job are completed before insert.
 *
 * @param context - Hono request context.
 * @returns The server-generated row id.
 */
export async function postAgentActivity(context: Context): Promise<Response> {
  const logger = context.get("logger");
  try {
    const body = await validateBody(context, postAgentActivityBodySchema);

    const row = await postAgentActivityService(body);

    return context.json({ id: row.id }, 201);
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }
    logger.error({ err: response }, "Post agent activity error");
    return context.json({ message: "Internal server error" }, 500);
  }
}
