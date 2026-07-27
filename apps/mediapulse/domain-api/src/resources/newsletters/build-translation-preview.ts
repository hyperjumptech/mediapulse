import type { Prisma, prisma } from "@mediapulse/database";

import {
  renderEmailPreview,
  type RenderEmailPreviewDeps,
} from "./render-email-preview";

export type BuildTranslationPreviewDeps = RenderEmailPreviewDeps & {
  newsletterTranslation: Pick<
    typeof prisma.newsletterTranslation,
    "findUnique"
  >;
};

export const buildTranslationPreview = async (
  newsletterId: string,
  tickerSymbol: string,
  language: "id",
  deps: BuildTranslationPreviewDeps,
): Promise<string | null> => {
  const findUniqueArgs = {
    where: { newsletterId_language: { newsletterId, language } },
    select: { subject: true, content: true },
  } satisfies Prisma.NewsletterTranslationFindUniqueArgs;
  const translation =
    await deps.newsletterTranslation.findUnique(findUniqueArgs);

  if (!translation) {
    return null;
  }

  return renderEmailPreview(
    {
      newsletterId,
      subject: translation.subject,
      bodyText: translation.content,
      tickerSymbol,
      language,
    },
    { renderHtml: deps.renderHtml, logger: deps.logger },
  );
};
