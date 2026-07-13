import { prisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";
import { logger } from "@workspace/logger";
import type { PostContentGenerationFetchEventsBody } from "@workspace/agent-data-api-contract";

export type FetchEventDb = {
  fetchEvent: Pick<typeof prisma.fetchEvent, "create">;
};

export const createFetchEvents = async (
  items: PostContentGenerationFetchEventsBody,
  deps: { db?: FetchEventDb } = {},
): Promise<{ recordedCount: number }> => {
  const db = deps.db ?? prisma;
  let recordedCount = 0;

  for (const item of items) {
    try {
      const createArgs = {
        data: {
          dataSourceId: item.dataSourceId,
          tickerId: item.tickerId,
          reason: item.reason,
          provider: item.provider ?? null,
          status: item.status,
        },
      } satisfies Prisma.FetchEventCreateArgs;
      await db.fetchEvent.create(createArgs);
      recordedCount += 1;
    } catch (error) {
      logger.warn(
        { dataSourceId: item.dataSourceId, err: error },
        "Failed to record fetch event",
      );
    }
  }

  return { recordedCount };
};
