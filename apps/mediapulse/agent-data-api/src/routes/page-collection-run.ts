import { Context } from "hono";

import {
  pageCollectionRunQuerySchema,
  postPageCollectionRunBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

export async function getPageCollectionRun(
  context: Context,
): Promise<Response> {
  try {
    const query = pageCollectionRunQuerySchema.parse(context.req.query());
    const data = await prisma.pageCollectionRun.findMany({
      where: {
        ...(query.tickerId && { tickerId: query.tickerId }),
        ...(query.start &&
          query.end && {
            startedAt: {
              gte: new Date(query.start),
              lte: new Date(query.end),
            },
          }),
      },
    });

    return context.json({ data }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postPageCollectionRun(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postPageCollectionRunBodySchema.parseAsync(body);

    await prisma.pageCollectionRun.create({
      data: {
        id: data.id,
        tickerId: data.tickerId ?? null,
        scheduleExecutionId: data.scheduleExecutionId ?? null,
        startedAt: new Date(data.startedAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
        status: data.status,
        snapshot: data.snapshot,
      },
    });

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
