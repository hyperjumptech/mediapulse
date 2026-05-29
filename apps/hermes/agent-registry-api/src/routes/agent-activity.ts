import { prisma } from "@hermes/orchestration-database";
import { Context } from "hono";
import { z } from "zod";
import { validateBody } from "@workspace/api-utils";

const postAgentActivityBodySchema = z.object({
  jobId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  status: z.enum(["processing", "completed"]),
});

/**
 * POST /agent-activity — records one activity heartbeat for a Hermes job.
 *
 * @param context - Hono request context.
 * @returns The server-generated row id.
 */
export async function postAgentActivity(context: Context): Promise<Response> {
  const logger = context.get("logger");
  try {
    const body = await validateBody(context, postAgentActivityBodySchema);

    const row = await prisma.agentActivity.create({
      data: {
        jobId: body.jobId,
        title: body.title,
        description: body.description ?? null,
        status: body.status,
      },
      select: { id: true },
    });

    return context.json({ id: row.id }, 201);
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }
    logger.error({ err: response }, "Post agent activity error");
    return context.json({ message: "Internal server error" }, 500);
  }
}
