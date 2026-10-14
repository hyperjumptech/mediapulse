import type { PrismaClient } from "@mediapulse/database";
import type { Day1WelcomeStory } from "@workspace/agent-data-api-contract";
import { readNewsletterDocument } from "@workspace/email-templates/newsletter-document";

export const WELCOME_STORY_ISSUE_LIMIT = 3;
export const WELCOME_STORY_WINDOW_DAYS = 14;
export const WELCOME_STORY_LIMIT = 4;
export const WELCOME_STORY_POINT_LIMIT = 2;

const DAY_MS = 86_400_000;

export type WelcomeStoryIssue = {
  content: string | null;
  publishedAtByUrl: ReadonlyMap<string, Date>;
};

export const selectWelcomeStories = (
  issues: WelcomeStoryIssue[],
): Day1WelcomeStory[] => {
  const seenUrls = new Set<string>();
  const stories: Day1WelcomeStory[] = [];
  for (const issue of issues) {
    if (issue.content === null || stories.length >= WELCOME_STORY_LIMIT) {
      continue;
    }
    const document = readNewsletterDocument(issue.content);
    if (document === undefined) {
      continue;
    }
    for (const section of document.sections) {
      for (const article of section.articles) {
        const url = article.url.trim();
        if (seenUrls.has(url) || stories.length >= WELCOME_STORY_LIMIT) {
          continue;
        }
        seenUrls.add(url);
        const publishedAt = issue.publishedAtByUrl.get(url);
        stories.push({
          title: article.title,
          url,
          ...(article.source !== undefined ? { source: article.source } : {}),
          ...(publishedAt !== undefined
            ? { publishedAt: publishedAt.toISOString() }
            : {}),
          points: article.points.slice(0, WELCOME_STORY_POINT_LIMIT),
        });
      }
    }
  }

  return stories;
};

export type WelcomeStoriesDb = Pick<PrismaClient, "newsletter">;

export type LoadWelcomeStoriesInput = {
  tickerId: string;
  language: "en" | "id";
  now: Date;
};

type IssueSectionItem = {
  url: string | null;
  dataSource: { publishedAt: Date | null } | null;
};

const mapPublishedAtByUrl = (items: IssueSectionItem[]): Map<string, Date> => {
  const publishedAtByUrl = new Map<string, Date>();
  for (const item of items) {
    const publishedAt = item.dataSource?.publishedAt;
    if (item.url !== null && publishedAt != null) {
      publishedAtByUrl.set(item.url.trim(), publishedAt);
    }
  }

  return publishedAtByUrl;
};

export const loadWelcomeStories = async (
  db: WelcomeStoriesDb,
  { tickerId, language, now }: LoadWelcomeStoriesInput,
): Promise<Day1WelcomeStory[]> => {
  const since = new Date(now.getTime() - WELCOME_STORY_WINDOW_DAYS * DAY_MS);
  const translationFilter =
    language === "en" ? {} : { translations: { some: { language } } };
  const newsletters = await db.newsletter.findMany({
    where: { tickerId, createdAt: { gte: since }, ...translationFilter },
    orderBy: { createdAt: "desc" },
    take: WELCOME_STORY_ISSUE_LIMIT,
    select: {
      content: true,
      translations: { where: { language }, select: { content: true } },
      sections: {
        select: {
          items: {
            select: {
              url: true,
              dataSource: { select: { publishedAt: true } },
            },
          },
        },
      },
    },
  });
  const issues = newsletters.map((newsletter) => {
    const translatedContent = newsletter.translations[0]?.content ?? null;
    const sectionItems = newsletter.sections.flatMap(
      (section) => section.items,
    );

    return {
      content: language === "en" ? newsletter.content : translatedContent,
      publishedAtByUrl: mapPublishedAtByUrl(sectionItems),
    };
  });

  return selectWelcomeStories(issues);
};
