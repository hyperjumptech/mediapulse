import { Context } from "hono";

import {
  articleAnalysisRunQuerySchema,
  postArticleAnalysisRunBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma, type Prisma } from "@mediapulse/database";

export async function getArticleAnalysisRun(
  context: Context,
): Promise<Response> {
  try {
    const query = articleAnalysisRunQuerySchema.parse(context.req.query());
    const data = await prisma.articleAnalysisRun.findMany({
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

export async function postArticleAnalysisRun(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postArticleAnalysisRunBodySchema.parseAsync(body);

    const record = {
      tickerId: data.tickerId ?? null,
      scheduleExecutionId: data.scheduleExecutionId ?? null,
      startedAt: new Date(data.startedAt),
      completedAt:
        data.completedAt !== undefined ? new Date(data.completedAt) : null,
      status: data.status,
      model: data.model ?? null,
      agentVersion: data.agentVersion ?? null,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      reasoningTokens: data.reasoningTokens,
      totalTokens: data.totalTokens,
      scored: data.scored,
      rejected: data.rejected,
      backlog: data.backlog,
      stopReason: data.stopReason ?? null,
      durationMs: data.durationMs ?? null,
    } satisfies Omit<Prisma.ArticleAnalysisRunUncheckedCreateInput, "id">;

    await prisma.articleAnalysisRun.upsert({
      where: { id: data.id },
      create: { id: data.id, ...record },
      update: record,
    });

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
