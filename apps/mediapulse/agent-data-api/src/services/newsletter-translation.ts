import { prisma as mediapulsePrisma } from "@mediapulse/database";
import type { PostNewsletterTranslationBody } from "@workspace/agent-data-api-contract";

/**
 * Upserts a translated rendering of a newsletter (unique per newsletter + language)
 * so a re-run of the content-generation translation pass is idempotent.
 *
 * @param body - Newsletter id, target language, translated subject/content, and optional provenance.
 */
export async function createNewsletterTranslation(
  body: PostNewsletterTranslationBody,
): Promise<void> {
  await mediapulsePrisma.newsletterTranslation.upsert({
    where: {
      newsletterId_language: {
        newsletterId: body.newsletterId,
        language: body.language,
      },
    },
    create: {
      newsletterId: body.newsletterId,
      language: body.language,
      subject: body.subject,
      content: body.content,
      model: body.model ?? null,
      promptTokens: body.promptTokens ?? null,
      completionTokens: body.completionTokens ?? null,
      totalTokens: body.totalTokens ?? null,
    },
    update: {
      subject: body.subject,
      content: body.content,
      model: body.model ?? null,
      promptTokens: body.promptTokens ?? null,
      completionTokens: body.completionTokens ?? null,
      totalTokens: body.totalTokens ?? null,
    },
  });
}
