import { prisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";
import { logger } from "@workspace/logger";
import type { PostContentGenerationSectionsBody } from "@workspace/agent-data-api-contract";

export type NewsletterSectionDb = {
  newsletterSection: Pick<typeof prisma.newsletterSection, "create">;
};

const isPrismaForeignKeyViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: string }).code === "P2003";

/**
 * Persists a newsletter's generated section structure (each section with its written items). Sections
 * are created independently, so one failed section does not discard the rest.
 *
 * @param body - Validated sections POST body.
 * @param deps - Injectable database delegates for tests.
 * @returns The number of sections recorded.
 */
export const createNewsletterSections = async (
  body: PostContentGenerationSectionsBody,
  deps: { db?: NewsletterSectionDb } = {},
): Promise<{ recordedSectionCount: number }> => {
  const db = deps.db ?? prisma;
  let recordedSectionCount = 0;

  for (const section of body.sections) {
    try {
      const createArgs = {
        data: {
          newsletterId: body.newsletterId,
          sectionKey: section.sectionKey,
          heading: section.heading,
          summary: section.summary,
          position: section.position,
          items: {
            create: section.items.map((item) => ({
              title: item.title,
              points: item.points,
              url: item.url,
              dataSourceId: item.dataSourceId,
              position: item.position,
            })),
          },
        },
      } satisfies Prisma.NewsletterSectionCreateArgs;
      await db.newsletterSection.create(createArgs);
      recordedSectionCount += 1;
    } catch (error) {
      if (isPrismaForeignKeyViolation(error)) {
        continue;
      }
      logger.warn(
        {
          newsletterId: body.newsletterId,
          sectionKey: section.sectionKey,
          err: error,
        },
        "Failed to record newsletter section",
      );
    }
  }

  return { recordedSectionCount };
};
