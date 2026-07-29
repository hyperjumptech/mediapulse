import { MEDIAPULSE_NEWSLETTER_SECTIONS } from "@workspace/agent-data-api-contract";
import type { Prisma, prisma } from "@mediapulse/database";

const STAGE_TIMEZONE = "Asia/Jakarta";

/** Agent id shown in the stage's Agent KPI card (a single agent produces this stage). */
const CONTENT_GENERATION_AGENT_ID = "content-generation" as const;

const SECTION_LABEL_BY_ID = new Map<string, string>(
  MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => [section.id, section.label]),
);

/**
 * One row of the Results list. A section-header row (`isSection`) carries the section heading, an
 * entry row carries an article headline linked to `url`, and a point row (`isPoint`) carries one of
 * the written points beneath it.
 */
export type ContentGenerationRowPayload = {
  label: string;
  url: string | null;
  isSection: boolean;
  isPoint: boolean;
};

/** Shape of the content-generation stage payload exposed by the detail handler. */
export type ContentGenerationPayload = {
  agentLabel: string;
  generatedAtLabel: string;
  model: string;
  tokensTotalLabel: string;
  tokensBreakdownLabel: string;
  rows: ContentGenerationRowPayload[];
};

/** Newsletter columns the stage reads for its KPI cards. */
export type ContentGenerationNewsletter = {
  id: string;
  createdAt: Date;
  model: string | null;
  agentVersion: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

/** Prisma collaborator surface for {@link buildContentGeneration}. */
export type BuildContentGenerationDeps = {
  newsletterSection: Pick<typeof prisma.newsletterSection, "findMany">;
};

const toFiniteNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const normalizeHeading = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Composes a section-header label from the canonical section name and the heading the agent wrote.
 *
 * @param label - Canonical newsletter section label.
 * @param heading - Heading persisted by content generation.
 * @returns `label - heading`, or `label` alone when the agent reused the section name.
 */
export const composeSectionHeaderLabel = (
  label: string,
  heading: string,
): string => {
  const trimmed = heading.trim();
  if (trimmed === "" || normalizeHeading(trimmed) === normalizeHeading(label)) {
    return label;
  }

  return `${label} - ${trimmed}`;
};

/**
 * The points to list under one written entry.
 *
 * @param points - Points persisted for the entry.
 * @returns Each point with surrounding whitespace removed, blanks dropped.
 */
export const entryPoints = (points: string[]): string[] =>
  points.map((point) => point.trim()).filter((point) => point !== "");

const compactNumber = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const formatGeneratedAt = (date: Date): string => {
  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: STAGE_TIMEZONE,
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: STAGE_TIMEZONE,
  }).format(date);

  return `${datePart} at ${timePart}`;
};

/**
 * Assembles the content-generation stage for a newsletter from its own generation columns (the writing
 * agent version, timing, LLM model and token spend) and the exact grounded section structure
 * content generation persisted (`NewsletterSection` + items). The Results list groups each section's
 * written entries under the heading the agent gave it, with per-entry summaries and source links.
 *
 * @param newsletter - The newsletter's generation columns.
 * @param deps - Prisma `newsletterSection` delegate.
 * @returns The stage KPIs and the grouped Results rows.
 */
export const buildContentGeneration = async (
  newsletter: ContentGenerationNewsletter,
  deps: BuildContentGenerationDeps,
): Promise<ContentGenerationPayload> => {
  const sections = await deps.newsletterSection.findMany({
    where: { newsletterId: newsletter.id },
    orderBy: { position: "asc" },
    select: {
      sectionKey: true,
      heading: true,
      summary: true,
      items: {
        orderBy: { position: "asc" },
        select: { title: true, points: true, url: true },
      },
    },
  } satisfies Prisma.NewsletterSectionFindManyArgs);

  const rows: ContentGenerationRowPayload[] = [];
  for (const section of sections) {
    const label =
      SECTION_LABEL_BY_ID.get(section.sectionKey) ?? section.sectionKey;
    rows.push({
      label: composeSectionHeaderLabel(label, section.heading),
      url: null,
      isSection: true,
      isPoint: false,
    });
    if (section.summary) {
      rows.push({
        label: section.summary,
        url: null,
        isSection: false,
        isPoint: false,
      });
    }
    for (const item of section.items) {
      rows.push({
        label: item.title,
        url: item.url,
        isSection: false,
        isPoint: false,
      });
      for (const point of entryPoints(item.points)) {
        rows.push({
          label: point,
          url: null,
          isSection: false,
          isPoint: true,
        });
      }
    }
  }

  const agentLabel = newsletter.agentVersion
    ? `${CONTENT_GENERATION_AGENT_ID} - ${newsletter.agentVersion}`
    : CONTENT_GENERATION_AGENT_ID;

  const promptTokens = toFiniteNumber(newsletter.promptTokens);
  const completionTokens = toFiniteNumber(newsletter.completionTokens);
  const totalTokens =
    toFiniteNumber(newsletter.totalTokens) || promptTokens + completionTokens;

  return {
    agentLabel,
    generatedAtLabel: formatGeneratedAt(newsletter.createdAt),
    model: newsletter.model ?? "—",
    tokensTotalLabel: compactNumber(totalTokens),
    tokensBreakdownLabel: `Input ${promptTokens.toLocaleString("en-US")} · Output ${completionTokens.toLocaleString("en-US")}`,
    rows,
  };
};
