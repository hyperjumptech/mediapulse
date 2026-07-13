import { prisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";
import { logger } from "@workspace/logger";
import type { PostContentGenerationCitationsBody } from "@workspace/agent-data-api-contract";

import { isPrismaUniqueViolation } from "./is-prisma-unique-violation.js";

export type NewsletterCitationDb = {
  newsletterCitation: Pick<typeof prisma.newsletterCitation, "create">;
};

const isPrismaForeignKeyViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: string }).code === "P2003";

export const createNewsletterCitations = async (
  body: PostContentGenerationCitationsBody,
  deps: { db?: NewsletterCitationDb } = {},
): Promise<{ recordedCount: number }> => {
  const db = deps.db ?? prisma;
  const seen = new Set<string>();
  let recordedCount = 0;

  for (const citation of body.citations) {
    const dedupeKey = `${citation.dataSourceId}:${citation.sectionKey}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    try {
      const createArgs = {
        data: {
          newsletterId: body.newsletterId,
          dataSourceId: citation.dataSourceId,
          sectionKey: citation.sectionKey,
        },
      } satisfies Prisma.NewsletterCitationCreateArgs;
      await db.newsletterCitation.create(createArgs);
      recordedCount += 1;
    } catch (error) {
      if (
        isPrismaUniqueViolation(error) ||
        isPrismaForeignKeyViolation(error)
      ) {
        continue;
      }
      logger.warn(
        {
          newsletterId: body.newsletterId,
          dataSourceId: citation.dataSourceId,
          err: error,
        },
        "Failed to record newsletter citation",
      );
    }
  }

  return { recordedCount };
};
