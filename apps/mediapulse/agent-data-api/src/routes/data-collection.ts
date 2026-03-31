import { Context } from "hono";

import {
  dataCollectionBodySchema,
  dataCollectionQuerySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

export async function getDataCollection(context: Context): Promise<Response> {
  try {
    const query = dataCollectionQuerySchema.parse(context.req.query());
    const data = await prisma.searchQuery.findMany({
      where: {
        tickerId: query.tickerId,
        OR: [{ set: { isActive: true } }, { setId: null }],
        ...(query.start &&
          query.end && {
            createdAt: {
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

export async function postDataCollection(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await dataCollectionBodySchema.parseAsync(body);
    await prisma.dataSource.createMany({ data });

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
