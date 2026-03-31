import { Context } from "hono";

import {
  dataCollectionFailureQuerySchema,
  postDataCollectionFailureBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

export async function getDataCollectionFailure(
  context: Context,
): Promise<Response> {
  try {
    const query = dataCollectionFailureQuerySchema.parse(context.req.query());
    const data = await prisma.dataCollectionFailure.findMany({
      where: {
        ...(query.tickerId && { tickerId: query.tickerId }),
        ...(query.runId && { runId: query.runId }),
      },
    });

    return context.json({ data }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postDataCollectionFailure(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const dataList = await postDataCollectionFailureBodySchema.parseAsync(body);

    await prisma.dataCollectionFailure.createMany({
      data: dataList.map((data) => ({
        id: data.id,
        runId: data.runId,
        tickerId: data.tickerId,
        stage: data.stage === "web-search" ? "web_search" : "web_fetch",
        provider: data.provider,
        searchQueryId: data.searchQueryId,
        url: data.url,
        errorCategory: data.errorCategory,
        retryable: data.retryable,
        httpStatus: data.httpStatus,
        message: data.message,
        createdAt: new Date(data.createdAt),
      })),
    });

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
