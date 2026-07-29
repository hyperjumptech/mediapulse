import { MEDIAPULSE_NEWSLETTER_SECTIONS } from "@workspace/agent-data-api-contract";
import type { Prisma, prisma } from "@mediapulse/database";

import {
  buildSectionScores,
  type SectionScorePayload,
} from "./build-section-scores";

const STAGE_TIMEZONE = "Asia/Jakarta";

/** Agent id shown in the stage's Agent KPI card (a single agent produces this stage). */
const ARTICLE_ANALYSIS_AGENT_ID = "article-analysis" as const;

const SECTION_LABEL_BY_ID = new Map<string, string>(
  MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => [section.id, section.label]),
);

const SECTION_ORDER_BY_ID = new Map<string, number>(
  MEDIAPULSE_NEWSLETTER_SECTIONS.map((section, index) => [section.id, index]),
);

const sectionOrder = (section: string | null): number =>
  section === null
    ? MEDIAPULSE_NEWSLETTER_SECTIONS.length
    : (SECTION_ORDER_BY_ID.get(section) ??
      MEDIAPULSE_NEWSLETTER_SECTIONS.length);

/** Badge variant for a section-fit score, banded green / orange / red. */
export type SourceAnalysisScoreVariant = "success" | "warning" | "destructive";

/** Shape of one analysed (assigned) article row in the Assigned results tab. */
export type SourceAnalysisEntryPayload = {
  id: string;
  title: string;
  url: string;
  sectionLabel: string;
  score: number | null;
  scoreLabel: string;
  scoreLine: string;
  scoreVariant: SourceAnalysisScoreVariant | null;
  reason: string;
  sectionScores: SectionScorePayload[];
};

/** Shape of one rejected article row in the Rejected results tab. */
export type SourceAnalysisRejectedPayload = {
  id: string;
  title: string;
  url: string;
  reason: string;
};

/** Shape of the source-analysis stage payload exposed by the detail handler. */
export type SourceAnalysisPayload = {
  agentLabel: string;
  generatedAtLabel: string;
  modelLabel: string;
  tokensTotalLabel: string;
  tokensBreakdownLabel: string;
  assigned: SourceAnalysisEntryPayload[];
  rejected: SourceAnalysisRejectedPayload[];
};

/** Prisma collaborator surface for {@link buildSourceAnalysis}. */
export type BuildSourceAnalysisDeps = {
  newsletterCitation: Pick<typeof prisma.newsletterCitation, "findMany">;
  articleAnalysisRun: Pick<typeof prisma.articleAnalysisRun, "findMany">;
  dataSourceTickerSection: Pick<
    typeof prisma.dataSourceTickerSection,
    "findMany"
  >;
};

const sectionLabel = (section: string | null): string =>
  section === null ? "—" : (SECTION_LABEL_BY_ID.get(section) ?? section);

const compactNumber = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

/** Bands a 0–1 section-fit score into a green / orange / red badge variant. */
const scoreVariantFor = (
  score: number | null,
): SourceAnalysisScoreVariant | null => {
  if (score === null) return null;
  if (score >= 0.7) return "success";
  if (score >= 0.4) return "warning";

  return "destructive";
};

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
 * Assembles the source-analysis stage for a newsletter from its exact citation join: each cited
 * source's per-ticker section classification (the Assigned tab), the sources the same analysis runs
 * rejected for this ticker (the Rejected tab), and those runs' model and token spend. Runs are traced
 * through each cited source's `articleAnalysisRunId`, so every figure is scoped to the exact runs
 * behind this newsletter rather than the ticker's wider analysis backlog. Each agent label carries
 * the analysing agent's version, read from the run record.
 *
 * @param newsletterId - Newsletter whose cited sources to analyse.
 * @param tickerId - Ticker the newsletter belongs to; scopes the per-ticker classification.
 * @param deps - Prisma `newsletterCitation`, `articleAnalysisRun`, and `dataSourceTickerSection` delegates.
 * @returns The stage KPIs, the assigned articles, and the rejected articles.
 */
export const buildSourceAnalysis = async (
  newsletterId: string,
  tickerId: string,
  deps: BuildSourceAnalysisDeps,
): Promise<SourceAnalysisPayload> => {
  const findManyArgs = {
    where: { newsletterId },
    include: {
      dataSource: {
        select: {
          id: true,
          url: true,
          title: true,
          tickerSections: {
            where: { tickerId },
            select: {
              section: true,
              sectionScore: true,
              sectionReason: true,
              sectionScoreBreakdown: true,
              articleAnalysisRunId: true,
            },
          },
        },
      },
    },
  } satisfies Prisma.NewsletterCitationFindManyArgs;

  const rows = await deps.newsletterCitation.findMany(findManyArgs);

  type CitationRow = Prisma.NewsletterCitationGetPayload<typeof findManyArgs>;

  const uniqueSources = new Map<string, CitationRow["dataSource"]>();
  for (const row of rows as CitationRow[]) {
    if (!uniqueSources.has(row.dataSource.id)) {
      uniqueSources.set(row.dataSource.id, row.dataSource);
    }
  }
  const dataSources = [...uniqueSources.values()];

  const runIds = [
    ...new Set(
      dataSources
        .map((dataSource) => dataSource.tickerSections[0]?.articleAnalysisRunId)
        .filter((runId): runId is string => runId != null),
    ),
  ];

  const [runs, rejectedRows] =
    runIds.length > 0
      ? await Promise.all([
          deps.articleAnalysisRun.findMany({
            where: { id: { in: runIds } },
            select: {
              id: true,
              startedAt: true,
              completedAt: true,
              model: true,
              agentVersion: true,
              promptTokens: true,
              completionTokens: true,
              reasoningTokens: true,
              totalTokens: true,
            },
          } satisfies Prisma.ArticleAnalysisRunFindManyArgs),
          deps.dataSourceTickerSection.findMany({
            where: {
              tickerId,
              section: null,
              articleAnalysisRunId: { in: runIds },
            },
            select: {
              sectionReason: true,
              articleAnalysisRunId: true,
              dataSource: { select: { id: true, url: true, title: true } },
            },
            orderBy: { analyzedAt: "desc" },
          } satisfies Prisma.DataSourceTickerSectionFindManyArgs),
        ])
      : [[], []];

  const versionByRunId = new Map<string, string>();
  const models = new Set<string>();
  let promptTokens = 0;
  let completionTokens = 0;
  let reasoningTokens = 0;
  let totalTokens = 0;
  let latestRunAt: Date | null = null;

  for (const run of runs) {
    if (run.agentVersion) versionByRunId.set(run.id, run.agentVersion);
    if (run.model) models.add(run.model);
    promptTokens += run.promptTokens;
    completionTokens += run.completionTokens;
    reasoningTokens += run.reasoningTokens;
    totalTokens += run.totalTokens;

    const runAt = run.completedAt ?? run.startedAt;
    if (latestRunAt === null || runAt.getTime() > latestRunAt.getTime()) {
      latestRunAt = runAt;
    }
  }

  const assigned = dataSources
    .map((dataSource) => {
      const tickerSection = dataSource.tickerSections[0];
      const section = tickerSection?.section ?? null;
      const label = sectionLabel(section);
      const score = tickerSection?.sectionScore ?? null;
      const scoreLabel = score === null ? "—" : score.toLocaleString("en-US");

      return {
        order: sectionOrder(section),
        entry: {
          id: dataSource.id,
          title: dataSource.title,
          url: dataSource.url,
          sectionLabel: label,
          score,
          scoreLabel,
          scoreLine: `${scoreLabel} - ${label}`,
          scoreVariant: scoreVariantFor(score),
          reason: tickerSection?.sectionReason ?? "",
          sectionScores: buildSectionScores(
            tickerSection?.sectionScoreBreakdown,
            section,
            score,
          ),
        } satisfies SourceAnalysisEntryPayload,
      };
    })
    .sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order;
      const leftScore = left.entry.score ?? -1;
      const rightScore = right.entry.score ?? -1;
      if (rightScore !== leftScore) return rightScore - leftScore;

      return left.entry.title.localeCompare(right.entry.title);
    })
    .map((item) => item.entry);

  const rejected = rejectedRows.map((outcome) => ({
    id: outcome.dataSource.id,
    title: outcome.dataSource.title,
    url: outcome.dataSource.url,
    reason: outcome.sectionReason ?? "",
  }));

  const versions = [...new Set([...versionByRunId.values()])].sort();
  const agentLabel =
    versions.length > 0
      ? `${ARTICLE_ANALYSIS_AGENT_ID} - ${versions.join(" · ")}`
      : ARTICLE_ANALYSIS_AGENT_ID;
  const modelLabel = models.size > 0 ? [...models].sort().join(" · ") : "—";

  return {
    agentLabel,
    generatedAtLabel: latestRunAt ? formatGeneratedAt(latestRunAt) : "—",
    modelLabel,
    tokensTotalLabel: compactNumber(totalTokens),
    tokensBreakdownLabel: `Input ${promptTokens.toLocaleString("en-US")} · Output ${completionTokens.toLocaleString("en-US")} · Reasoning ${reasoningTokens.toLocaleString("en-US")}`,
    assigned,
    rejected,
  };
};
