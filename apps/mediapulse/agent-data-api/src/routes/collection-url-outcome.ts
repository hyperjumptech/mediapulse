import { Context } from "hono";

import { postCollectionUrlOutcomeBodySchema } from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

export async function postCollectionUrlOutcome(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const dataList = await postCollectionUrlOutcomeBodySchema.parseAsync(body);

    await prisma.collectionUrlOutcome.createMany({
      data: dataList.map((item) => ({
        id: item.id,
        scheduleExecutionId: item.scheduleExecutionId ?? null,
        runId: item.runId,
        tickerId: item.tickerId ?? null,
        agent:
          item.agent === "data-collection"
            ? "data_collection"
            : "page_collection",
        status: item.status,
        url: item.url,
        reason: item.reason ?? null,
        reasonDetail: item.reasonDetail ?? null,
        source: item.source ?? null,
        searchQueryId: item.searchQueryId ?? null,
        curatedSourceId: item.curatedSourceId ?? null,
        createdAt: new Date(item.createdAt),
      })),
      skipDuplicates: true,
    });

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
