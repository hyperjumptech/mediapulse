import { Context } from "hono";

import {
  dataCollectionRunQuerySchema,
  postDataCollectionRunBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

export async function getDataCollectionRun(
  context: Context,
): Promise<Response> {
  try {
    const query = dataCollectionRunQuerySchema.parse(context.req.query());
    const data = await prisma.dataCollectionRun.findMany({
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

export async function postDataCollectionRun(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postDataCollectionRunBodySchema.parseAsync(body);

    const {
      queriesTotal,
      urlsTotal,
      searchSuccess,
      searchFailed,
      fetchSuccess,
      fetchFailed,
      retryCount,
      ...extendedCounterFields
    } = data.counters;
    const hasExtended = Object.keys(extendedCounterFields).length > 0;

    await prisma.dataCollectionRun.create({
      data: {
        id: data.id,
        tickerId: data.tickerId ?? null,
        scheduleExecutionId: data.scheduleExecutionId ?? null,
        startedAt: new Date(data.startedAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
        status: data.status,
        queriesTotal,
        urlsTotal,
        searchSuccess,
        searchFailed,
        fetchSuccess,
        fetchFailed,
        retryCount,
        ...(hasExtended ? { extendedCounters: extendedCounterFields } : {}),
      },
    });

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
