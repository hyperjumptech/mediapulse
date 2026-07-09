import { Context } from "hono";

import {
  pageCollectionFailureQuerySchema,
  postPageCollectionFailureBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

export async function getPageCollectionFailure(
  context: Context,
): Promise<Response> {
  try {
    const query = pageCollectionFailureQuerySchema.parse(context.req.query());
    const data = await prisma.pageCollectionFailure.findMany({
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

export async function postPageCollectionFailure(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const dataList = await postPageCollectionFailureBodySchema.parseAsync(body);

    await prisma.pageCollectionFailure.createMany({
      data: dataList.map((data) => ({
        id: data.id,
        runId: data.runId,
        tickerId: data.tickerId,
        stage: data.stage === "web-search" ? "web_search" : "web_fetch",
        provider: data.provider,
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
