import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";

import {
  MEDIAPULSE_NEWSLETTER_SECTIONS,
  NEWSLETTER_SECTION_IDS,
  type NewsletterSectionId,
} from "@workspace/agent-data-api-contract";
import { applyContractBrief } from "@workspace/agent-runtime";
import {
  NEWSLETTER_SECTION_KEYS,
  type NewsletterArticle,
  type NewsletterDocument,
  type NewsletterSection,
  type NewsletterSectionKey,
} from "@workspace/email-templates/newsletter-document";
import { formatNewsletterEmailSubject } from "@workspace/email-templates/newsletter-email-subject";
import { logger } from "@workspace/logger";

import {
  CONTENT_GENERATION_CONSTANTS,
  type ResolvedContentGenerationConfig,
} from "./config-schema.js";
import {
  dedupeSourcesAgainstRecentBullets,
  type RecentBullet,
} from "./lib/cross-run-dedup.js";
import {
  dedupeCrossSectionSourceEvents,
  type EventDedupDrop,
} from "./lib/event-dedup.js";
import { pointsSupportTitle } from "./lib/points-support-title.js";
import { dropStaleForSection } from "./lib/section-freshness.js";
import { retryWithBackoff } from "./lib/retry.js";
import { sanitizeSummaryPoints } from "./lib/sanitize-summary-points.js";
import { truncateSources } from "./lib/truncate-sources.js";
import { isRetryableLlmError } from "./llm-classify-error.js";
import { selectArticles, type SelectedArticle } from "./select-articles.js";
import {
  articleSummarySchema,
  buildArticlePrompt,
  SUMMARIZE_ARTICLE_SYSTEM_PROMPT,
} from "./summarize-article.js";
import {
  buildSubjectFallback,
  buildSubjectPrompt,
  newsletterSubjectSchema,
  WRITE_SUBJECT_SYSTEM_PROMPT,
} from "./write-subject.js";
import type { SourceForGeneration } from "./types.js";

export type { SourceForGeneration };

/** Maximum summarizer requests in flight at once. */
export const SUMMARIZER_CONCURRENCY = 5;

/** Maps a stored document section key to the camelCase id the agent-data-api contract stores. */
export const SECTION_ID_BY_DOCUMENT_KEY: Record<
  NewsletterSectionKey,
  NewsletterSectionId
> = {
  "industry-pulse": "industryPulse",
  "issuer-performance": "issuerPerformance",
  "competitive-landscape": "competitiveLandscape",
  "deals-and-movements": "dealsAndMovements",
  "regulatory-policy-watch": "regulatoryPolicyWatch",
  "disruptors-or-tech": "disruptorsOrTech",
  "quick-hits": "quickHits",
};

const DOCUMENT_KEY_BY_SECTION_ID = Object.fromEntries(
  Object.entries(SECTION_ID_BY_DOCUMENT_KEY).map(([documentKey, sectionId]) => [
    sectionId,
    documentKey as NewsletterSectionKey,
  ]),
) as Record<NewsletterSectionId, NewsletterSectionKey>;

const SECTION_LABEL_BY_ID = Object.fromEntries(
  MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => [section.id, section.label]),
) as Record<NewsletterSectionId, string>;

/** Per-section article and removal counts from the final newsletter document. */
export type SectionFillSnapshot = {
  bySection: Record<NewsletterSectionId, { citedBullets: number }>;
  sectionsRemoved: NewsletterSectionId[];
};

/**
 * Counts cited articles shipped per newsletter section from the final document.
 * Sections absent from the document contribute 0.
 *
 * @param document - Final document after all pruning passes.
 * @returns Per-section article counts.
 */
export const computeNewsletterSectionFill = (
  document: NewsletterDocument,
): Record<NewsletterSectionId, { citedBullets: number }> => {
  const countByDocumentKey = new Map<string, number>();
  for (const section of document.sections) {
    countByDocumentKey.set(
      section.key,
      (countByDocumentKey.get(section.key) ?? 0) + section.articles.length,
    );
  }

  return Object.fromEntries(
    NEWSLETTER_SECTION_IDS.map((id) => [
      id,
      {
        citedBullets:
          countByDocumentKey.get(DOCUMENT_KEY_BY_SECTION_ID[id]) ?? 0,
      },
    ]),
  ) as Record<NewsletterSectionId, { citedBullets: number }>;
};

export type NewsletterCitationLink = {
  dataSourceId: string;
  sectionKey: string;
};

export const collectNewsletterCitations = (
  document: NewsletterDocument,
  sources: readonly SourceForGeneration[],
): NewsletterCitationLink[] => {
  const dataSourceIdByUrl = new Map<string, string>();
  for (const source of sources) {
    if (source.dataSourceId !== undefined && source.url.length > 0) {
      dataSourceIdByUrl.set(source.url, source.dataSourceId);
    }
  }

  const seen = new Set<string>();
  const citations: NewsletterCitationLink[] = [];

  for (const section of document.sections) {
    const sectionKey = SECTION_ID_BY_DOCUMENT_KEY[section.key];
    for (const article of section.articles) {
      const dataSourceId = dataSourceIdByUrl.get(article.url);
      if (dataSourceId === undefined) {
        continue;
      }
      const dedupeKey = `${dataSourceId}:${sectionKey}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      citations.push({ dataSourceId, sectionKey });
    }
  }

  return citations;
};

/** One written entry within a section, linked to its source article. */
export type NewsletterSectionItemLink = {
  title: string;
  points: string[];
  url: string | null;
  dataSourceId: string | null;
  position: number;
};

/** One section of the shipped newsletter: heading and its written items. */
export type NewsletterSectionLink = {
  sectionKey: string;
  heading: string;
  summary: string | null;
  position: number;
  items: NewsletterSectionItemLink[];
};

/**
 * Builds the grounded section structure from the final document, in document order.
 *
 * The document carries no display heading, so each row stores the canonical section label from the
 * agent-data-api contract, which is what the reader sees above that section.
 *
 * @param document - Final document.
 * @param sources - Selected sources, used to resolve each article's URL back to its data source id.
 * @returns Sections with their items, ready to persist.
 */
export const collectNewsletterSections = (
  document: NewsletterDocument,
  sources: readonly SourceForGeneration[],
): NewsletterSectionLink[] => {
  const dataSourceIdByUrl = new Map<string, string>();
  for (const source of sources) {
    if (source.url.length > 0 && source.dataSourceId !== undefined) {
      dataSourceIdByUrl.set(source.url, source.dataSourceId);
    }
  }

  return document.sections.map((section, position) => {
    const sectionKey = SECTION_ID_BY_DOCUMENT_KEY[section.key];

    return {
      sectionKey,
      heading: SECTION_LABEL_BY_ID[sectionKey],
      summary: null,
      position,
      items: section.articles.map((article, itemPosition) => ({
        title: article.title,
        points: article.points,
        url: article.url,
        dataSourceId: dataSourceIdByUrl.get(article.url) ?? null,
        position: itemPosition,
      })),
    };
  });
};

/** Structured newsletter content returned after a successful generation pass. */
export interface GeneratedContent {
  /** Compelling email subject line (under ~60 chars). */
  subject: string;
  /** Newsletter body: a JSON `newsletterDocumentSchema` document. */
  content: string;
}

/**
 * Extended return type that additionally surfaces token usage and the exact
 * prompt strings sent to the model, needed for provenance fields (MP-CGA-008).
 */
export interface GeneratedContentWithProvenance extends GeneratedContent {
  /**
   * Prompt tokens summed across every summarizer call plus the subject call.
   * `null` when no AI SDK response included usage data.
   */
  promptTokens: number | null;
  /**
   * Completion tokens summed across every summarizer call plus the subject call.
   * `null` when no AI SDK response included usage data.
   */
  completionTokens: number | null;
  /**
   * Total tokens summed across every summarizer call plus the subject call.
   * `null` when no AI SDK response included usage data.
   */
  totalTokens: number | null;
  /** The exact system prompt sent to every summarizer call. */
  systemPrompt: string;
  /** Manifest of the shipped articles, one `sectionKey | title` line per article in render order. */
  resolvedUserPrompt: string;
  /**
   * Reasoning tokens summed across every call that reported them.
   * Present only when the model reports them (gpt-5/o-series with reasoning effort set).
   */
  structuredReasoningTokens?: number;
  /** Articles dropped because their summarizer call failed every retry. */
  articlesSkippedSummaryFailed?: number;
  /** Per-section article counts and removed-section list from the final document. */
  sectionFillSnapshot?: SectionFillSnapshot;
  newsletterCitations?: NewsletterCitationLink[];
  /** The exact grounded section structure (heading + written items) as generated. */
  newsletterSections?: NewsletterSectionLink[];
  /** Cross-day dedup counters, present when a recent-bullet corpus was provided. */
  crossRunDedupSummary?: {
    removedCount: number;
    bySection: Record<string, number>;
  };
  /** Cross-section same-event dedup counters and per-drop provenance, present when it removed rows. */
  crossSectionEventDedupSummary?: {
    removedCount: number;
    drops: EventDedupDrop[];
  };
}

/** Structured output shapes this agent asks the model for. */
export type NewsletterObjectSchema =
  | typeof articleSummarySchema
  | typeof newsletterSubjectSchema;

/** Minimal arguments for a single `generateObject` call. */
export type GenerateNewsletterObjectArgs = {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: NewsletterObjectSchema;
  system: string;
  prompt: string;
  /** Should always be 0 — we manage our own retry loop via retryWithBackoff. */
  maxRetries: number;
  /** Per-request timeout in milliseconds (passed to the AI SDK). */
  timeout?: number;
};

/** Token usage extracted from a single `generateObject` response. */
export type GenerateNewsletterObjectUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};

/** Result of a single `generateObject` call. */
export type GenerateNewsletterObjectResult = {
  object: unknown;
  /**
   * Token usage from the AI SDK response.
   * Present when the model/provider returns usage data; absent otherwise.
   */
  usage?: GenerateNewsletterObjectUsage;
};

/** Injectable wrapper around `generateObject` to allow test substitution. */
export type GenerateNewsletterObjectFn = (
  args: GenerateNewsletterObjectArgs,
) => Promise<GenerateNewsletterObjectResult>;

const defaultGenerateNewsletterObject: GenerateNewsletterObjectFn = async (
  args,
) => {
  const result = await generateObject({
    ...args,
  });
  // AI SDK v6 uses inputTokens/outputTokens (not promptTokens/completionTokens).
  // We map to the contract names (promptTokens/completionTokens/totalTokens) here
  // so the rest of the codebase speaks the contract vocabulary.
  const usage = result.usage
    ? {
        promptTokens: result.usage.inputTokens,
        completionTokens: result.usage.outputTokens,
        totalTokens:
          result.usage.inputTokens !== undefined &&
          result.usage.outputTokens !== undefined
            ? result.usage.inputTokens + result.usage.outputTokens
            : undefined,
        // reasoningTokens is present on reasoning models (gpt-5/o-series).
        ...(result.usage.reasoningTokens !== undefined
          ? { reasoningTokens: result.usage.reasoningTokens }
          : {}),
      }
    : undefined;

  return { object: result.object, usage };
};

/**
 * Orders sources by their authoritative upstream `section` so downstream passes see articles
 * grouped section-by-section. Ordering within a section is otherwise preserved (stable sort).
 *
 * @param sources - Sources to group.
 * @returns Sources reordered so that articles sharing a section are contiguous.
 */
export const groupSourcesBySection = (
  sources: readonly SourceForGeneration[],
): SourceForGeneration[] => {
  const sectionOrder = new Map<string, number>(
    NEWSLETTER_SECTION_IDS.map((id, index) => [id, index]),
  );
  const rankOf = (source: SourceForGeneration): number => {
    if (source.section === undefined || source.section === null) {
      return NEWSLETTER_SECTION_IDS.length;
    }

    return sectionOrder.get(source.section) ?? NEWSLETTER_SECTION_IDS.length;
  };

  return sources
    .map((source, index) => ({ source, index }))
    .sort((left, right) => {
      const rankDiff = rankOf(left.source) - rankOf(right.source);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.source);
};

/** Thrown when the pipeline cannot assemble a newsletter with at least one article. */
export class EmptyNewsletterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyNewsletterError";
  }
}

const trimmedOrUndefined = (value?: string | null): string | undefined => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : undefined;
};

const hasRenderableUrl = (source: SourceForGeneration): boolean =>
  /^https?:\/\//i.test(source.url.trim());

/**
 * Runs `worker` over `items` with at most `concurrency` calls in flight, preserving input order.
 *
 * @param items - Work items.
 * @param concurrency - Maximum simultaneous workers.
 * @param worker - Async task run per item.
 * @returns Results in the same order as `items`.
 */
const mapWithConcurrency = async <TItem, TResult>(
  items: readonly TItem[],
  concurrency: number,
  worker: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> => {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]!);
    }
  };

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
};

type SummaryOutcome =
  | {
      status: "summarized";
      entry: SelectedArticle;
      title: string;
      points: string[];
    }
  | { status: "failed"; entry: SelectedArticle };

type TokenTotals = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  reasoningTokens: number | null;
};

const createTokenTotals = (): TokenTotals => ({
  promptTokens: null,
  completionTokens: null,
  totalTokens: null,
  reasoningTokens: null,
});

/** Folds one call's usage into the running totals, leaving a field `null` while never reported. */
const addUsage = (
  totals: TokenTotals,
  usage?: GenerateNewsletterObjectUsage,
): void => {
  if (usage === undefined) {
    return;
  }
  for (const field of [
    "promptTokens",
    "completionTokens",
    "totalTokens",
    "reasoningTokens",
  ] as const) {
    const value = usage[field];
    if (value !== undefined) {
      totals[field] = (totals[field] ?? 0) + value;
    }
  }
};

/**
 * Generates newsletter content by summarizing one selected article at a time.
 *
 * Pipeline: truncate candidate sources, dedup them against recently published bullets and against
 * each other, select the top articles per section by `sectionScore`, summarize each selected
 * article in its own bounded-concurrency `generateObject` call, write the subject in one further
 * call over the selected titles, then assemble the document in code. Titles, URLs, and bylines come
 * from the source row, never from the model.
 *
 * A single article whose summarizer call fails every retry is skipped and counted. A failed subject
 * call falls back to the lead article's title.
 *
 * @param sources - Fetched data sources to summarise into a newsletter.
 * @param config - Resolved agent config (only the model block is read).
 * @param context - Dynamic values for prompt placeholder substitution and light KG context.
 * @param deps - Injectable dependencies: `generateObjectFn` and `sleepFn` for testing.
 * @returns Generated newsletter content plus provenance metadata.
 * @throws `EmptyNewsletterError` when selection or summarization leaves no article to ship.
 */
export async function generateNewsletterWithLlm(
  sources: SourceForGeneration[],
  config: ResolvedContentGenerationConfig,
  context: {
    tickerId: string;
    date: string;
    tickerName?: string;
    tickerSymbol?: string;
    /** KG-resolved competitor list from the content-generation API. */
    competitors?: Array<{ name: string; relation: string }>;
    /** Issuer aliases from the content-generation API. */
    issuerAliases?: string[];
    /** Opaque product brief from the Agent Contract; appended to the system prompt when present. */
    brief?: string;
    /** Recently published bullets for this ticker, used for cross-day dedup. */
    recentBullets?: RecentBullet[];
  },
  deps: {
    generateObjectFn?: GenerateNewsletterObjectFn;
    sleepFn?: (ms: number) => Promise<void>;
  } = {},
): Promise<GeneratedContentWithProvenance> {
  const generateFn = deps.generateObjectFn ?? defaultGenerateNewsletterObject;
  const { requestTimeoutMs, truncation, retry } = CONTENT_GENERATION_CONSTANTS;

  const truncatedSources = truncateSources(
    sources,
    truncation.maxCharsPerSource,
    truncation.maxTotalContextChars,
  ).filter(hasRenderableUrl);

  // Dedup runs before any LLM call so no tokens are spent on an article about to be discarded.
  const recentBullets = context.recentBullets ?? [];
  let candidateSources: SourceForGeneration[] = truncatedSources;

  let crossRunDedupSummary:
    | { removedCount: number; bySection: Record<string, number> }
    | undefined;
  if (recentBullets.length > 0) {
    const crossRunDeduped = dedupeSourcesAgainstRecentBullets(
      candidateSources,
      recentBullets,
      CONTENT_GENERATION_CONSTANTS.crossRunDedup.similarity,
    );
    candidateSources = crossRunDeduped.sources;
    crossRunDedupSummary = {
      removedCount: crossRunDeduped.removedCount,
      bySection: crossRunDeduped.bySection,
    };

    if (crossRunDeduped.removedCount > 0) {
      logger.info(
        {
          tickerId: context.tickerId,
          removedCount: crossRunDeduped.removedCount,
          bySection: crossRunDeduped.bySection,
          minSimilarity: CONTENT_GENERATION_CONSTANTS.crossRunDedup.similarity,
          event: "cross_run_dedup",
        },
        `Cross-run dedup: removed ${String(crossRunDeduped.removedCount)} source(s) repeating recent newsletters`,
      );
    }
  }

  let crossSectionEventDedupSummary:
    | { removedCount: number; drops: EventDedupDrop[] }
    | undefined;
  if (CONTENT_GENERATION_CONSTANTS.eventDedup.enabled) {
    const eventDeduped = dedupeCrossSectionSourceEvents(
      candidateSources,
      CONTENT_GENERATION_CONSTANTS.eventDedup.minSharedAnchors,
      CONTENT_GENERATION_CONSTANTS.eventDedup.minContainment,
    );
    candidateSources = eventDeduped.sources;
    if (eventDeduped.removedCount > 0) {
      crossSectionEventDedupSummary = {
        removedCount: eventDeduped.removedCount,
        drops: eventDeduped.drops,
      };
      logger.info(
        {
          tickerId: context.tickerId,
          removedCount: eventDeduped.removedCount,
          drops: eventDeduped.drops,
          event: "cross_section_event_dedup",
        },
        `Cross-section event dedup: removed ${String(eventDeduped.removedCount)} same-event source(s)`,
      );
    }
  }

  const sectionFreshness = dropStaleForSection(candidateSources);
  if (sectionFreshness.droppedCount > 0) {
    candidateSources = sectionFreshness.sources;
    logger.info(
      {
        tickerId: context.tickerId,
        droppedCount: sectionFreshness.droppedCount,
        drops: sectionFreshness.drops,
        event: "section_freshness_dropped",
      },
      `Section freshness: dropped ${String(sectionFreshness.droppedCount)} source(s) older than their section tolerates`,
    );
  }

  const selection = selectArticles(candidateSources);
  logger.info(
    {
      tickerId: context.tickerId,
      selectedCount: selection.selected.length,
      ...selection.report,
      event: "article_selection",
    },
    "Article selection complete",
  );

  if (selection.selected.length === 0) {
    throw new EmptyNewsletterError(
      "Article selection produced no articles for the newsletter",
    );
  }

  const openai = createOpenAI({
    apiKey: config.model.apiKey,
    ...(config.model.baseUrl ? { baseURL: config.model.baseUrl } : {}),
  });
  const model = openai(config.model.model);

  const systemPrompt = applyContractBrief(
    SUMMARIZE_ARTICLE_SYSTEM_PROMPT,
    context.brief !== undefined ? { brief: context.brief } : undefined,
  );

  const tokenTotals = createTokenTotals();

  const summaryOutcomes = await mapWithConcurrency(
    selection.selected,
    SUMMARIZER_CONCURRENCY,
    async (entry): Promise<SummaryOutcome> => {
      try {
        const result = await retryWithBackoff(
          async () =>
            generateFn({
              model,
              schema: articleSummarySchema,
              system: systemPrompt,
              prompt: buildArticlePrompt(entry.source),
              maxRetries: 0,
              timeout: requestTimeoutMs,
            }),
          retry,
          isRetryableLlmError,
          { sleepFn: deps.sleepFn },
        );
        const summary = articleSummarySchema.parse(result.object);
        addUsage(tokenTotals, result.usage);

        // A stray non-Latin glyph or a point cut off against the length budget ships as visibly
        // broken prose, so the point is withheld rather than rendered. An article left with no
        // usable point counts as a summarization failure and drops out with the rest.
        const sanitized = sanitizeSummaryPoints(summary.points);
        if (sanitized.dropped.length > 0) {
          logger.warn(
            {
              tickerId: context.tickerId,
              sectionKey: entry.sectionKey,
              url: entry.source.url,
              dropped: sanitized.dropped,
              keptCount: sanitized.points.length,
              event: "summary_point_rejected",
            },
            `Dropped ${String(sanitized.dropped.length)} unusable summary point(s)`,
          );
        }
        if (sanitized.points.length === 0) {
          return { status: "failed", entry };
        }

        if (!pointsSupportTitle(summary.title, sanitized.points)) {
          logger.warn(
            {
              tickerId: context.tickerId,
              sectionKey: entry.sectionKey,
              url: entry.source.url,
              title: summary.title,
              points: sanitized.points,
              event: "summary_points_off_heading",
            },
            "Dropped article: no summary point relates to its own heading",
          );

          return { status: "failed", entry };
        }

        return {
          status: "summarized",
          entry,
          title: summary.title,
          points: sanitized.points,
        };
      } catch (err) {
        logger.warn(
          {
            tickerId: context.tickerId,
            sectionKey: entry.sectionKey,
            url: entry.source.url,
            err,
            event: "article_summary_failed",
          },
          "Article summarization failed after retries; skipping article",
        );

        return { status: "failed", entry };
      }
    },
  );

  const articlesSkippedSummaryFailed = summaryOutcomes.filter(
    (outcome) => outcome.status === "failed",
  ).length;

  if (articlesSkippedSummaryFailed === summaryOutcomes.length) {
    throw new EmptyNewsletterError(
      "Every selected article failed to summarize",
    );
  }

  if (articlesSkippedSummaryFailed > 0) {
    logger.warn(
      {
        tickerId: context.tickerId,
        skippedCount: articlesSkippedSummaryFailed,
        selectedCount: summaryOutcomes.length,
        event: "article_summaries_skipped",
      },
      `Skipped ${String(articlesSkippedSummaryFailed)} article(s) whose summarization failed`,
    );
  }

  const articlesBySection = new Map<
    NewsletterSectionKey,
    NewsletterArticle[]
  >();
  const selectedSources: SourceForGeneration[] = [];
  for (const outcome of summaryOutcomes) {
    if (outcome.status !== "summarized") {
      continue;
    }
    const { source } = outcome.entry;
    const author = trimmedOrUndefined(source.author);
    const sourceName = trimmedOrUndefined(source.source);
    const article: NewsletterArticle = {
      title: outcome.title,
      url: source.url.trim(),
      points: outcome.points,
      ...(author !== undefined ? { author } : {}),
      ...(sourceName !== undefined ? { source: sourceName } : {}),
    };
    const bucket = articlesBySection.get(outcome.entry.sectionKey) ?? [];
    bucket.push(article);
    articlesBySection.set(outcome.entry.sectionKey, bucket);
    selectedSources.push(source);
  }

  const sections: NewsletterSection[] = NEWSLETTER_SECTION_KEYS.flatMap(
    (key) => {
      const articles = articlesBySection.get(key);

      return articles === undefined || articles.length === 0
        ? []
        : [{ key, articles }];
    },
  );

  if (sections.length === 0) {
    throw new EmptyNewsletterError(
      "No section survived summarization; refusing to persist an empty newsletter",
    );
  }

  const sectionsAttempted = new Set(
    selection.selected.map((entry) => entry.sectionKey),
  );
  const sectionsShipped = new Set(sections.map((section) => section.key));
  const sectionsRemoved = [...sectionsAttempted]
    .filter((key) => !sectionsShipped.has(key))
    .map((key) => SECTION_ID_BY_DOCUMENT_KEY[key]);

  const document: NewsletterDocument = { version: 1, sections };

  const shippedHeadlines = document.sections.flatMap((section) =>
    section.articles.map((article) => ({
      title: article.title,
      section: SECTION_ID_BY_DOCUMENT_KEY[section.key] ?? section.key,
    })),
  );
  const shippedTitles = shippedHeadlines.map((headline) => headline.title);
  let subjectTitle = buildSubjectFallback(shippedTitles);
  try {
    const subjectResult = await retryWithBackoff(
      async () =>
        generateFn({
          model,
          schema: newsletterSubjectSchema,
          system: WRITE_SUBJECT_SYSTEM_PROMPT,
          prompt: buildSubjectPrompt(shippedHeadlines, {
            symbol: context.tickerSymbol,
            name: context.tickerName,
          }),
          maxRetries: 0,
          timeout: requestTimeoutMs,
        }),
      retry,
      isRetryableLlmError,
      { sleepFn: deps.sleepFn },
    );
    subjectTitle = newsletterSubjectSchema.parse(subjectResult.object).subject;
    addUsage(tokenTotals, subjectResult.usage);
  } catch (err) {
    logger.warn(
      {
        tickerId: context.tickerId,
        err,
        event: "subject_generation_failed",
      },
      "Subject generation failed after retries; falling back to the lead article title",
    );
  }

  const subject = formatNewsletterEmailSubject(
    context.tickerSymbol ?? "",
    subjectTitle,
  );

  const resolvedUserPrompt = document.sections
    .flatMap((section) =>
      section.articles.map((article) => `${section.key} | ${article.title}`),
    )
    .join("\n");

  return {
    subject,
    content: JSON.stringify(document),
    promptTokens: tokenTotals.promptTokens,
    completionTokens: tokenTotals.completionTokens,
    totalTokens: tokenTotals.totalTokens,
    systemPrompt,
    resolvedUserPrompt,
    ...(tokenTotals.reasoningTokens !== null
      ? { structuredReasoningTokens: tokenTotals.reasoningTokens }
      : {}),
    articlesSkippedSummaryFailed,
    sectionFillSnapshot: {
      bySection: computeNewsletterSectionFill(document),
      sectionsRemoved,
    },
    newsletterCitations: collectNewsletterCitations(document, selectedSources),
    newsletterSections: collectNewsletterSections(document, selectedSources),
    ...(crossRunDedupSummary ? { crossRunDedupSummary } : {}),
    ...(crossSectionEventDedupSummary ? { crossSectionEventDedupSummary } : {}),
  };
}
