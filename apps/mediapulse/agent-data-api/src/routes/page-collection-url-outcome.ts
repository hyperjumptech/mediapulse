import { Context } from "hono";

import { postPageCollectionUrlOutcomeBodySchema } from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

export async function postPageCollectionUrlOutcome(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const dataList =
      await postPageCollectionUrlOutcomeBodySchema.parseAsync(body);

    await prisma.pageCollectionUrlOutcome.createMany({
      data: dataList.map((item) => ({
        id: item.id,
        scheduleExecutionId: item.scheduleExecutionId ?? null,
        runId: item.runId,
        tickerId: item.tickerId ?? null,
        status: item.status,
        url: item.url,
        reason: item.reason ?? null,
        reasonDetail: item.reasonDetail ?? null,
        source: item.source ?? null,
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
