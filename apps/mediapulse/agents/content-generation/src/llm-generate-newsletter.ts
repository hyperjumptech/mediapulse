import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import type { z } from "zod";

import {
  NEWSLETTER_SECTION_IDS,
  type NewsletterSectionId,
} from "@workspace/agent-data-api-contract";
import {
  applyContractBrief,
  buildOpenAiReasoningProviderOptions,
  type OpenAiReasoningProviderOptions,
} from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";

import type { ResolvedContentGenerationConfig } from "./config-schema.js";
import { formatIndustryNewsletterWire } from "./format-industry-newsletter.js";
import {
  industryNewsletterStructureLlmSchema,
  industryNewsletterStructureSchema,
} from "./industry-newsletter-schema.js";
import { attachIndustryNewsletterSourceUrls } from "./industry-newsletter-urls.js";
import {
  pruneNewsletterToCitedRows,
  type PruneSummary,
} from "./lib/prune-uncited-rows.js";
import { isRetryableLlmError } from "./llm-classify-error.js";
import {
  buildExemplarPromptSection,
  detectExemplarPlagiarism,
  fitSourcesForExemplarBudget,
  pickExemplarsForTicker,
} from "./lib/newsletter-exemplars.js";
import {
  groundNewsletterCitations,
  type BulletGroundingReport,
  type CitationGroundingSummary,
} from "./lib/citation-grounding.js";
import {
  applyNewsletterCritiqueResults,
  buildNewsletterCritiqueSystemPrompt,
  buildNewsletterCritiqueUserPrompt,
  collectNewsletterCritiqueCandidates,
  countNewsletterCritiqueBullets,
  critiqueNewsletter,
  type GenerateObjectForNewsletterCritique,
  type NewsletterCritiqueSummary,
  newsletterCritiqueSchema,
} from "./lib/newsletter-self-critique.js";
import {
  applyNumericAnchorPolicy,
  extractNumericAnchorsFromSources,
  formatAnchorsForPrompt,
  selectTopAnchors,
  type NumericAnchorSummary,
} from "./lib/numeric-anchors.js";
import {
  buildCrossRunDedupObservability,
  dedupBullets,
  formatRecentBulletsAvoidanceBlock,
  type RecentBullet,
} from "./lib/cross-run-dedup.js";
import {
  polishNewsletter,
  type PolishNewsletterResult,
} from "./lib/newsletter-polish.js";
import {
  buildSubjectCandidatePrompt,
  buildSubjectCandidateSystemPrompt,
  fetchSubjectCandidates,
  pickBestSubject,
  type GenerateObjectForSubjectCandidates,
  type SubjectLineSummary,
} from "./lib/subject-line.js";
import {
  buildSourceMixObservability,
  diversifyByHost,
  rankSourcesForNewsletter,
} from "./lib/source-ranking.js";
import { retryWithBackoff } from "./lib/retry.js";
import { truncateSources } from "./lib/truncate-sources.js";
import {
  enforceCompetitiveFocus,
  type FocusSummary,
} from "./lib/competitive-landscape-focus.js";
import type { SourceForGeneration } from "./types.js";

export type { SourceForGeneration };

/** Self-critique JSON schema for the critic `generateObject` pass. */
export { newsletterCritiqueSchema };

/** Per-section bullet and removal counts from the final resolved newsletter. */
export type SectionFillSnapshot = {
  bySection: Record<NewsletterSectionId, { citedBullets: number }>;
  sectionsRemoved: NewsletterSectionId[];
};

/**
 * Counts cited bullets shipped per newsletter section from the final resolved structure.
 * Prose sections (`industryPulse`, `disruptorsOrTech` when format=prose) count as 1 item each.
 * Sections absent in the resolved structure contribute 0.
 *
 * @param resolved - Final resolved newsletter after all pruning passes.
 * @returns Per-section bullet counts.
 */
export const computeNewsletterSectionFill = (
  resolved: import("./industry-newsletter-urls.js").IndustryNewsletterResolved,
): Record<NewsletterSectionId, { citedBullets: number }> => {
  const disruptorsOrTechCount =
    resolved.disruptorsOrTech === undefined
      ? 0
      : resolved.disruptorsOrTech.format === "bullets"
        ? resolved.disruptorsOrTech.bullets.length
        : 1;

  return Object.fromEntries(
    NEWSLETTER_SECTION_IDS.map((id) => {
      let citedBullets: number;
      if (id === "industryPulse") {
        citedBullets = resolved.industryPulse !== undefined ? 1 : 0;
      } else if (id === "competitiveLandscape") {
        citedBullets = resolved.competitiveLandscape?.bullets.length ?? 0;
      } else if (id === "dealsAndMovements") {
        citedBullets = resolved.dealsAndMovements?.bullets.length ?? 0;
      } else if (id === "regulatoryPolicyWatch") {
        citedBullets = resolved.regulatoryPolicyWatch?.bullets.length ?? 0;
      } else if (id === "disruptorsOrTech") {
        citedBullets = disruptorsOrTechCount;
      } else {
        citedBullets = resolved.quickHits?.items.length ?? 0;
      }

      return [id, { citedBullets }];
    }),
  ) as Record<NewsletterSectionId, { citedBullets: number }>;
};

/** Structured newsletter content returned after a successful LLM call. */
export interface GeneratedContent {
  /** Compelling email subject line (under ~60 chars). */
  subject: string;
  /** Formatted plain-text newsletter body (`MP_NEWSLETTER` industry wire). */
  content: string;
  /** Optional executive summary for newsletter preview or listing. */
  description?: string;
}

/**
 * Extended return type that additionally surfaces token usage and the exact
 * prompt strings sent to the model, needed for provenance fields (MP-CGA-008).
 */
export interface GeneratedContentWithProvenance extends GeneratedContent {
  /**
   * Number of prompt tokens consumed by the LLM call.
   * `null` when the AI SDK response does not include usage data.
   */
  promptTokens: number | null;
  /**
   * Number of completion tokens generated by the LLM call.
   * `null` when the AI SDK response does not include usage data.
   */
  completionTokens: number | null;
  /**
   * Total tokens consumed by the LLM call (`promptTokens + completionTokens`).
   * `null` when the AI SDK response does not include usage data.
   */
  totalTokens: number | null;
  /** The exact system prompt sent to the model (before any retry). */
  systemPrompt: string;
  /** The exact user prompt sent to the model after source substitution. */
  resolvedUserPrompt: string;
  /** Whether the structured pass was conditioned on a brainstorm memo. */
  brainstormUsed: boolean;
  /**
   * Brainstorm-pass prompt tokens.
   * Structured-pass tokens remain in {@link promptTokens}.
   */
  brainstormPromptTokens: number | null;
  /** Brainstorm-pass completion tokens. */
  brainstormCompletionTokens: number | null;
  /**
   * Reasoning tokens consumed by the structured pass.
   * Present only when the model reports them (gpt-5/o-series with reasoning effort set).
   * Reasoning tokens come out of the output budget, so a tight `credentials.maxTokens`
   * can truncate the structured JSON when reasoning effort is enabled.
   */
  structuredReasoningTokens?: number;
  /** Per-bullet grounding reports (present when citation grounding is enabled). */
  citationGroundingReports?: BulletGroundingReport[];
  /** Rolled-up citation grounding counters for run details. */
  citationGroundingSummary?: CitationGroundingSummary;
  /** Numeric anchor extraction and coverage metrics when enabled. */
  numericAnchorSummary?: NumericAnchorSummary;
  /** Email preheader from subject-line selection (for delivery preview text). */
  preheader?: string;
  /** Subject-line candidate ranking summary when enabled. */
  subjectLineSummary?: SubjectLineSummary;
  /** Cross-run dedup counters when enabled. */
  crossRunDedupSummary?: ReturnType<typeof buildCrossRunDedupObservability>;
  /** True when most new bullets overlap recent history (operator signal). */
  lowInformationDay?: boolean;
  /** Self-critique counters when the critic pass ran. */
  critiqueSummary?: NewsletterCritiqueSummary;
  /** True when critique was skipped because the run exceeded 70% of timeout budget. */
  critiqueSkippedDueToBudget?: boolean;
  /** True when the critique pass threw (e.g. truncated JSON) and was skipped. */
  critiqueFailed?: boolean;
  /** Style polish rule-firing summary when enabled. */
  polishSummary?: Pick<
    PolishNewsletterResult,
    "reports" | "totalReplacements" | "rulesFired"
  >;
  /** Require-citation pruning counters when the pass is enabled. */
  requireCitationSummary?: PruneSummary;
  /** Competitive-focus gate counters when the pass ran and had competitors. */
  competitiveFocusSummary?: FocusSummary;
  /** Per-section bullet counts and removed-section list from the final resolved newsletter. */
  sectionFillSnapshot?: SectionFillSnapshot;
}

/**
 * In-memory contract for parsed brainstorm sections (plain-text memo, not JSON).
 * Used for tests and optional downstream conditioning — the LLM sees raw text.
 */
export type NewsletterBrainstorm = {
  headlineThesis: string;
  threadsToWeave: string[];
  standoutNumbers: string[];
  whatChanged: string[];
  whatToWatch: string[];
  toneNote: string;
};

/** Minimal arguments for a single `generateObject` call for newsletter generation. */
export type GenerateNewsletterObjectArgs = {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof industryNewsletterStructureLlmSchema;
  system: string;
  prompt: string;
  /** Should always be 0 — we manage our own retry loop via retryWithBackoff. */
  maxRetries: number;
  /** Per-request timeout in milliseconds (passed to the AI SDK). */
  timeout?: number;
  /** Maximum tokens to generate (passed to `generateObject`). */
  maxTokens?: number;
  /** Provider-specific options (e.g. `{ openai: { reasoningEffort } }`). Omit for non-reasoning models. */
  providerOptions?: OpenAiReasoningProviderOptions;
};

/** Token usage extracted from a single `generateObject` response. */
export type GenerateNewsletterObjectUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};

/** Result of a single `generateObject` call for newsletter generation. */
export type GenerateNewsletterObjectResult = {
  object: z.infer<typeof industryNewsletterStructureSchema>;
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
  const { providerOptions, ...rest } = args;
  const result = await generateObject({
    ...rest,
    ...(providerOptions !== undefined ? { providerOptions } : {}),
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

/** Arguments for a single brainstorm `generateText` call. */
export type GenerateTextForNewsletterBrainstormArgs = {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  /** Should always be 0 — retries are managed at the orchestration layer. */
  maxRetries: number;
  /** Per-request timeout in milliseconds (passed to the AI SDK). */
  timeout?: number;
  /** Provider-specific options (e.g. `{ openai: { reasoningEffort } }`). Omit for non-reasoning models. */
  providerOptions?: OpenAiReasoningProviderOptions;
};

/** Token usage from a brainstorm `generateText` response. */
export type NewsletterBrainstormUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

/** Result of the free-form brainstorm pass. */
export type NewsletterBrainstormCallResult = {
  text: string;
  usage: NewsletterBrainstormUsage | null;
};

/** Injectable wrapper around brainstorm `generateText` for tests. */
export type GenerateTextForNewsletterBrainstorm = (
  args: GenerateTextForNewsletterBrainstormArgs,
) => Promise<NewsletterBrainstormCallResult>;

const defaultGenerateTextForNewsletterBrainstorm: GenerateTextForNewsletterBrainstorm =
  async (args) => {
    const { providerOptions, ...rest } = args;
    const result = await generateText({
      ...rest,
      ...(providerOptions !== undefined ? { providerOptions } : {}),
    });
    const usage =
      result.usage !== undefined
        ? {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
          }
        : null;
    return { text: result.text, usage };
  };

/** Fixed JSON overhead (wrapper object, schema scaffolding) for the critique pass. */
const CRITIQUE_TOKENS_BASE_OVERHEAD = 256;
/** Output-token allowance per critique rating row (scores + rationale + optional rewrite). */
const CRITIQUE_TOKENS_PER_CANDIDATE = 180;

const BRAINSTORM_SYSTEM_PROMPT = [
  "You are an editorial planner for a daily industry briefing.",
  "Before drafting the briefing, write a one-page editor's memo with six labeled sections:",
  "HEADLINE THESIS (one sentence — what is THE story this week?),",
  "THREADS TO WEAVE (3–5 sub-themes, prose, no bullets),",
  "STANDOUT NUMBERS (any concrete figures worth quoting verbatim — revenue, %, deal size; one per line, with the Article N source),",
  "WHAT CHANGED (3–5 changes vs. the previous baseline — leadership, market share, regulation),",
  "WHAT TO WATCH (1–3 forward-looking items grounded in the articles),",
  "TONE NOTE (one sentence — should this week be sober, optimistic, contrarian, technical?).",
  "Plain text only. No JSON.",
].join(" ");

/** Prefix injected before brainstorm text in the structured-pass user prompt. */
export const BRAINSTORM_STRUCTURED_PASS_PREFIX = [
  "Below is your editor's memo for this week.",
  "Use it as the spine for the briefing — every section should reflect a thread from the memo, every quoted number should come from STANDOUT NUMBERS, and the tone should match TONE NOTE.",
  "Then produce the JSON briefing.",
].join(" ");

/**
 * Builds the numbered `Article N:` block shared by brainstorm and structured passes.
 *
 * @param sources - Sources in prompt order.
 * @returns Joined article summaries.
 */
export const buildArticleSummariesBlock = (
  sources: readonly SourceForGeneration[],
): string => {
  return sources
    .map(
      (source, index) =>
        `Article ${String(index + 1)}: ${source.title}\n${source.content}`,
    )
    .join("\n\n---\n\n");
};

/**
 * Returns the brainstorm-pass system prompt (plain-text memo, no JSON schema).
 *
 * @param ctx - Ticker and article-count context for orientation.
 */
export const buildBrainstormSystemPrompt = (ctx: {
  tickerName?: string;
  tickerSymbol?: string;
  topNewsCount: number;
}): string => {
  const tickerLabel =
    ctx.tickerName !== undefined && ctx.tickerSymbol !== undefined
      ? `${ctx.tickerName} (${ctx.tickerSymbol})`
      : (ctx.tickerName ?? ctx.tickerSymbol ?? "the sector");
  return `${BRAINSTORM_SYSTEM_PROMPT}\n\nOrient around ${tickerLabel}. You receive ${String(ctx.topNewsCount)} numbered articles.`;
};

/**
 * Builds the brainstorm user prompt using the same article block as the structured pass.
 *
 * @param sources - Selected sources for this run.
 * @param context - Date and ticker placeholders for optional template reuse.
 */
export const buildBrainstormUserPrompt = (
  sources: readonly SourceForGeneration[],
  context: {
    date: string;
    topNewsCount: number;
  },
): string => {
  return [
    `Today is ${context.date}. Read the ${String(context.topNewsCount)} articles below and write the editor's memo.`,
    "",
    buildArticleSummariesBlock(sources),
  ].join("\n");
};

/**
 * Parses brainstorm plain text into the in-memory {@link NewsletterBrainstorm} contract.
 *
 * @param text - Raw brainstorm model output.
 */
export const parseNewsletterBrainstormText = (
  text: string,
): NewsletterBrainstorm => {
  const sections: NewsletterBrainstorm = {
    headlineThesis: "",
    threadsToWeave: [],
    standoutNumbers: [],
    whatChanged: [],
    whatToWatch: [],
    toneNote: "",
  };

  const sectionMatchers: Array<{
    key: keyof NewsletterBrainstorm;
    labels: string[];
    multiLine: boolean;
  }> = [
    { key: "headlineThesis", labels: ["HEADLINE THESIS"], multiLine: false },
    { key: "threadsToWeave", labels: ["THREADS TO WEAVE"], multiLine: true },
    {
      key: "standoutNumbers",
      labels: ["STANDOUT NUMBERS"],
      multiLine: true,
    },
    { key: "whatChanged", labels: ["WHAT CHANGED"], multiLine: true },
    { key: "whatToWatch", labels: ["WHAT TO WATCH"], multiLine: true },
    { key: "toneNote", labels: ["TONE NOTE"], multiLine: false },
  ];

  const lines = text.split("\n");
  let current: { key: keyof NewsletterBrainstorm; multiLine: boolean } | null =
    null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    const matched = sectionMatchers.find((section) =>
      section.labels.some((label) => {
        const upper = line.toUpperCase();
        return (
          upper === label ||
          upper.startsWith(`${label}:`) ||
          upper.startsWith(`${label} `)
        );
      }),
    );

    if (matched) {
      current = { key: matched.key, multiLine: matched.multiLine };
      const inlineValue = line.replace(/^[^:]+:\s*/i, "").trim();
      if (!matched.multiLine && inlineValue.length > 0) {
        sections[matched.key] = inlineValue as never;
        current = null;
      }
      continue;
    }

    if (current === null) {
      continue;
    }

    const value = line.replace(/^[-*•]\s*/, "").trim();
    if (value.length === 0) {
      continue;
    }

    if (current.multiLine) {
      const bucket = sections[current.key];
      if (Array.isArray(bucket)) {
        bucket.push(value);
      }
    } else {
      sections[current.key] = value as never;
    }
  }

  return sections;
};

/**
 * Runs the free-form brainstorm pass via `generateText`.
 *
 * @param params - API credentials, model, prompts, and token limit.
 * @param deps - Injectable `generateText` wrapper for tests.
 */
export const fetchNewsletterBrainstorm = async (
  params: {
    apiKey: string;
    baseUrl?: string;
    model: string;
    maxOutputTokens: number;
    system: string;
    prompt: string;
    timeout?: number;
    providerOptions?: OpenAiReasoningProviderOptions;
  },
  deps: {
    generateTextFn?: GenerateTextForNewsletterBrainstorm;
  } = {},
): Promise<NewsletterBrainstormCallResult> => {
  const generateTextFn =
    deps.generateTextFn ?? defaultGenerateTextForNewsletterBrainstorm;
  const openai = createOpenAI({
    apiKey: params.apiKey,
    ...(params.baseUrl !== undefined ? { baseURL: params.baseUrl } : {}),
  });

  return generateTextFn({
    model: openai(params.model),
    system: params.system,
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens,
    maxRetries: 0,
    ...(params.timeout !== undefined ? { timeout: params.timeout } : {}),
    ...(params.providerOptions !== undefined
      ? { providerOptions: params.providerOptions }
      : {}),
  });
};

/**
 * System prompt sent to the LLM for newsletter generation.
 *
 * Exported so callers (e.g. `run.ts`) can compute `promptHash` from the exact
 * string passed to the model without duplicating the constant.
 *
 * Supported placeholders: `{{topNewsCount}}`, `{{tickerId}}`, `{{tickerName}}`, `{{tickerSymbol}}`.
 */
export const SYSTEM_PROMPT = `You are an industry intelligence editor for busy business owners and executives.

Audience: leaders who want sector context, competition, regulation, and deals — not stock tips. Never give buy/sell/hold guidance, price targets, or personal investment advice.

Use {{tickerName}} ({{tickerSymbol}}) to orient the industry intelligence lens. Do not make every paragraph only about that single ticker; widen to industry dynamics when the articles support it.

Focus on what is happening outside the company — macro forces, regulatory shifts, competitive moves, technology disruption. Do not include earnings guidance, internal financial projections, or company-specific forecast commentary.

You receive exactly {{topNewsCount}} numbered articles (Article 1 … Article {{topNewsCount}}). Ground claims in those articles. When a bullet or quick hit should link to a source in the final email, set "articleIndex" to the 1-based article number from that list. Never output URLs in JSON; the system injects them. Never write "(Article N)" or bare article numbers inside any "text" or "prose" field; citations are expressed only via "articleIndex", and the system renders the visible link.

Return JSON matching this shape (camelCase keys):
- "subject": short email subject (under ~60 chars), sector-relevant, may mention {{tickerName}} or {{tickerSymbol}} once if natural.
- "industryPulse": { "displayHeading", "prose", "articleIndex" } — short lead framing the industry story (no bullet characters in prose). Set "articleIndex" to the single most representative article the lead summarizes; use null when the lead does not lean on a specific article.
- "competitiveLandscape": { "displayHeading", "bullets" } — 2–3 bullets about {{tickerName}}'s COMPETITORS, not {{tickerName}} itself — peer positioning, rival launches, share shifts, competitive threats. Each bullet should name a competitor. Each bullet { "text", "articleIndex" } where articleIndex is a 1-based article number or null when uncited.
- "dealsAndMovements": { "displayHeading", "bullets" } — 1–3 bullets; same articleIndex rule.
- "regulatoryPolicyWatch": { "displayHeading", "bullets" } — 1–3 bullets; same articleIndex rule.
- "disruptorsOrTech": either { "format": "prose", "displayHeading", "prose" } OR { "format": "bullets", "displayHeading", "bullets" } with 1–3 bullets (same articleIndex rule).
- "quickHits": { "displayHeading", "items" } — 5–7 items; each item { "text", "articleIndex" } (index required for every quick hit).

Headings ("displayHeading") are short subtitle phrases only — never repeat the section label or use "Label / Subtitle" format. Keep JSON valid; use null for optional blocks and uncited articleIndex values.

Every bullet and quick hit must summarize exactly one article and set articleIndex to that one article. Do not blend multiple articles into one bullet, and do not reuse the same article for two bullets in a section.`;

/**
 * Default user prompt template used when no template is provided in config.
 */
export const DEFAULT_USER_PROMPT_TEMPLATE = `Today is {{date}}. Use that date to vary emphasis week to week (for example alternate between global macro vs regional industry notes) without inventing facts.

Write one JSON industry briefing using the {{topNewsCount}} numbered articles below. Follow the system JSON shape exactly.

Rules reminder:
- Industry and competitive lens; no trading advice.
- Use "articleIndex" to point at Article 1 … Article {{topNewsCount}} from this prompt. Set articleIndex to null on a bullet when there is no clear single-article grounding.
- Quick hits must all include articleIndex.

{{sourceSummaries}}`;

/**
 * Builds the competitor directive block injected into the user prompt when
 * the KG has resolved named competitors for the issuer.
 *
 * Returns an empty string when `competitors` is empty, so the caller can
 * safely include it without an extra length guard.
 *
 * @param competitors - Named competitors from the KG resolution pass.
 * @param issuerName - Human-readable issuer name for the directive text.
 */
export const buildCompetitorPromptBlock = (
  competitors: ReadonlyArray<{ name: string; relation: string }>,
  issuerName: string,
): string => {
  if (competitors.length === 0) return "";
  const nameList = competitors.map((competitor) => competitor.name).join(", ");
  return [
    `Competitive Landscape must focus on these competitors of ${issuerName}: ${nameList}.`,
    `Frame each bullet around a competitor's move, market share shift, product launch, or competitive threat.`,
    `Do NOT make these bullets about ${issuerName} itself.`,
  ].join(" ");
};

/**
 * Builds the LLM user prompt from the list of data sources, substituting
 * placeholders in the provided template.
 *
 * Supported placeholders:
 * - `{{sourceSummaries}}`: Numbered list of article titles and content.
 * - `{{tickerId}}`: The identifier of the ticker being processed.
 * - `{{tickerName}}`: The human-readable company name (e.g. "Bank Central Asia").
 * - `{{tickerSymbol}}`: The exchange ticker symbol (e.g. "BBCA").
 * - `{{date}}`: The current ISO date (YYYY-MM-DD).
 * - `{{topNewsCount}}`: The number of articles included in this prompt (and max articleIndex).
 *
 * Exported so callers can compute `promptHash` from the exact string passed to
 * the model after source substitution.
 *
 * @param sources - Fetched articles/sources to include in the prompt.
 * @param template - Prompt template with placeholders (falls back to `DEFAULT_USER_PROMPT_TEMPLATE`).
 * @param context - Dynamic values for placeholder substitution.
 * @returns Formatted user-turn string for the LLM.
 */
export function buildUserPrompt(
  sources: SourceForGeneration[],
  template: string = DEFAULT_USER_PROMPT_TEMPLATE,
  context: {
    tickerId: string;
    date: string;
    topNewsCount: number;
    tickerName?: string;
    tickerSymbol?: string;
  },
  options: {
    /** Exemplar section prepended before `{{sourceSummaries}}` when few-shot is enabled. */
    exemplarSection?: string;
    /** Editor's memo from the brainstorm pass, injected before article summaries. */
    brainstormText?: string;
    /** Competitor directive injected above article summaries when the KG has named peers. */
    competitorSection?: string;
    /** Verbatim figures sidecar injected immediately above article summaries. */
    numericAnchorSection?: string;
    /** Recent bullets to avoid repeating (cross-run dedup preventive arm). */
    crossRunDedupAvoidanceSection?: string;
  } = {},
): string {
  const sourceSummaries = buildArticleSummariesBlock(sources);

  const exemplarPrefix =
    options.exemplarSection !== undefined && options.exemplarSection.length > 0
      ? `${options.exemplarSection}\n\n`
      : "";

  const brainstormPrefix =
    options.brainstormText !== undefined &&
    options.brainstormText.trim().length > 0
      ? `${BRAINSTORM_STRUCTURED_PASS_PREFIX}\n\n${options.brainstormText.trim()}\n\n`
      : "";

  const numericAnchorPrefix =
    options.numericAnchorSection !== undefined &&
    options.numericAnchorSection.length > 0
      ? `${options.numericAnchorSection}\n\n`
      : "";

  const crossRunDedupPrefix =
    options.crossRunDedupAvoidanceSection !== undefined &&
    options.crossRunDedupAvoidanceSection.length > 0
      ? `${options.crossRunDedupAvoidanceSection}\n\n`
      : "";

  const competitorPrefix =
    options.competitorSection !== undefined &&
    options.competitorSection.length > 0
      ? `${options.competitorSection}\n\n`
      : "";

  return template
    .replaceAll(
      "{{sourceSummaries}}",
      `${exemplarPrefix}${brainstormPrefix}${crossRunDedupPrefix}${competitorPrefix}${numericAnchorPrefix}${sourceSummaries}`,
    )
    .replaceAll("{{tickerId}}", context.tickerId)
    .replaceAll("{{tickerName}}", context.tickerName ?? context.tickerId)
    .replaceAll("{{tickerSymbol}}", context.tickerSymbol ?? context.tickerId)
    .replaceAll("{{date}}", context.date)
    .replaceAll("{{topNewsCount}}", String(context.topNewsCount));
}

/**
 * Generates newsletter content from data sources via the Vercel AI SDK with retry logic.
 *
 * Selects the top `topNewsCount` sources (by relevance order from the caller) and asks
 * the LLM for an industry briefing JSON object. Source URLs are attached after the call
 * from each optional or required `articleIndex`, then serialized to the `MP_NEWSLETTER`
 * plain-text wire format for email parsing.
 *
 * Retries on transient errors (rate limits, server errors, timeouts) up to
 * `config.reliability.llmRetry.maxAttempts` times with exponential backoff and optional jitter.
 * Non-retryable errors (auth failure, bad request, schema validation) are thrown immediately.
 *
 * Returns the generated content together with token usage and the exact prompt
 * strings sent to the model, enabling the caller to compute provenance fields
 * (`promptHash`, `promptTokens`, `completionTokens`, `totalTokens`) without
 * needing to reconstruct the prompts.
 *
 * @param sources - Fetched data sources to summarise into a newsletter.
 * @param config - Resolved agent config including `reliability.llmRetry` and `credentials.timeoutMs`.
 * @param context - Dynamic values for prompt placeholder substitution (`tickerId`, `date`, `tickerName`, `tickerSymbol`).
 * @param deps - Injectable dependencies: `generateObjectFn` and `sleepFn` for testing.
 * @returns Generated newsletter content plus provenance metadata.
 * @throws `APICallError` | `TypeValidationError` | `NoObjectGeneratedError` on failure.
 */
export async function generateNewsletterWithLlm(
  sources: SourceForGeneration[],
  config: ResolvedContentGenerationConfig,
  context: {
    tickerId: string;
    date: string;
    tickerName?: string;
    tickerSymbol?: string;
    /** Wall-clock start of the agent run for deadline guards (from `run.ts`). */
    runStartedAt?: number;
    /** Recent newsletter subjects for novelty scoring (last 7 days). */
    recentSubjects?: string[];
    /** Recent flattened bullets for cross-run dedup. */
    recentBullets?: RecentBullet[];
    /** KG-resolved competitor list from the content-generation API (plan 71). */
    competitors?: Array<{ name: string; relation: string }>;
    /** Issuer aliases from the content-generation API (plan 71). */
    issuerAliases?: string[];
    /** Opaque product brief from the Agent Contract; appended to the system prompt when present. */
    brief?: string;
  },
  deps: {
    generateObjectFn?: GenerateNewsletterObjectFn;
    generateTextFn?: GenerateTextForNewsletterBrainstorm;
    critiqueGenerateObjectFn?: GenerateObjectForNewsletterCritique;
    subjectGenerateObjectFn?: GenerateObjectForSubjectCandidates;
    sleepFn?: (ms: number) => Promise<void>;
    /** Injectable clock for deadline-budget tests. */
    nowFn?: () => number;
  } = {},
): Promise<GeneratedContentWithProvenance> {
  const generateFn = deps.generateObjectFn ?? defaultGenerateNewsletterObject;
  const nowFn = deps.nowFn ?? Date.now;
  const generationStartedAt = nowFn();

  const topNewsCount = config.output.topNewsCount;

  // Truncate sources per configurable character limits before building prompts
  // (MP-CGA-004 / FR8). Sources are tail-truncated per-source, then overall
  // total is capped by dropping the least-relevant sources from the end.
  const maxCharsPerSource = config.inputs.context.maxCharsPerSource;
  const maxTotalContextChars = config.inputs.context.maxTotalContextChars;
  const truncatedSources = truncateSources(
    sources,
    maxCharsPerSource,
    maxTotalContextChars,
  );

  const sourceRanking = config.inputs.sourceRanking;
  let selectedSources: SourceForGeneration[];

  if (sourceRanking.enabled) {
    const ranked = rankSourcesForNewsletter(truncatedSources, {
      recencyHalfLifeHours: sourceRanking.recencyHalfLifeHours,
      weights: sourceRanking.weights,
    });
    const diversified = diversifyByHost(ranked, {
      maxPerHost: sourceRanking.maxPerHost,
      limit: topNewsCount,
    });
    selectedSources = diversified.slice(0, topNewsCount);

    logger.info(
      buildSourceMixObservability(context.tickerId, diversified),
      "Source ranking: selected mix for LLM prompt",
    );
  } else {
    // Pre-select up to N sources for the prompt. Sources arrive sorted by relevance
    // from getDataSourcesForTicker; articleIndex values refer to Article 1 … Article N
    // in the user prompt in this same order.
    selectedSources = truncatedSources.slice(0, topNewsCount);
  }

  const openai = createOpenAI({
    apiKey: config.credentials.openaiApiKey,
    ...(config.credentials.baseUrl
      ? { baseURL: config.credentials.baseUrl }
      : {}),
  });
  const model = openai(config.credentials.chatModel);

  // Wire prompts from config with fallback to defaults (MP-CGA-003 / MP-CGA-008).
  const fewShot = config.inputs.fewShot;
  let exemplarSection = "";
  let exemplarsUsed: string[] = [];
  let activeExemplars: ReturnType<typeof pickExemplarsForTicker> = [];
  let sourcesDroppedForExemplarSpace = 0;
  let promptSources = selectedSources;

  if (fewShot.enabled) {
    activeExemplars = pickExemplarsForTicker(
      context.tickerSymbol ?? context.tickerId,
      context.tickerName ?? context.tickerId,
      selectedSources,
      {
        maxExemplars: fewShot.maxExemplars,
        ...(fewShot.sectorTag !== undefined
          ? { sectorTag: fewShot.sectorTag }
          : {}),
      },
    );
    exemplarSection = buildExemplarPromptSection(activeExemplars);
    exemplarsUsed = activeExemplars.map((exemplar) => exemplar.id);

    // When exemplars + sources exceed the context cap, drop sources from the end
    // before dropping exemplars — voice calibration is more valuable than tail sources.
    const fitted = fitSourcesForExemplarBudget(
      selectedSources,
      exemplarSection,
      maxTotalContextChars,
    );
    promptSources = fitted.sources;
    sourcesDroppedForExemplarSpace = fitted.sourcesDroppedForExemplarSpace;

    logger.info(
      {
        tickerId: context.tickerId,
        exemplarsUsed,
        promptCharsAddedByExemplars: exemplarSection.length,
        sourcesDroppedForExemplarSpace,
      },
      "Few-shot exemplars: injected into newsletter prompt",
    );
  }

  const effectiveTopNewsCount = promptSources.length;

  const timeout = config.credentials.timeoutMs;
  const maxTokens = config.credentials.maxTokens;

  let brainstormText: string | undefined;
  let brainstormUsed = false;
  let brainstormPromptTokens: number | null = null;
  let brainstormCompletionTokens: number | null = null;

  if (config.creativity.brainstorm.enabled) {
    const brainstormSystemPrompt = buildBrainstormSystemPrompt({
      tickerName: context.tickerName,
      tickerSymbol: context.tickerSymbol,
      topNewsCount: effectiveTopNewsCount,
    });
    const brainstormUserPrompt = buildBrainstormUserPrompt(promptSources, {
      date: context.date,
      topNewsCount: effectiveTopNewsCount,
    });

    try {
      const brainstormStartedAt = nowFn();
      const brainstormProviderOptions = buildOpenAiReasoningProviderOptions(
        config.brainstormReasoningEffort,
      );
      const brainstormResult = await fetchNewsletterBrainstorm(
        {
          apiKey: config.credentials.openaiApiKey,
          ...(config.credentials.baseUrl !== undefined
            ? { baseUrl: config.credentials.baseUrl }
            : {}),
          model: config.brainstormModel,
          maxOutputTokens: config.creativity.brainstorm.maxOutputTokens,
          system: brainstormSystemPrompt,
          prompt: brainstormUserPrompt,
          ...(timeout !== undefined ? { timeout } : {}),
          ...(brainstormProviderOptions !== undefined
            ? { providerOptions: brainstormProviderOptions }
            : {}),
        },
        { generateTextFn: deps.generateTextFn },
      );

      brainstormPromptTokens = brainstormResult.usage?.inputTokens ?? null;
      brainstormCompletionTokens = brainstormResult.usage?.outputTokens ?? null;

      const elapsedMs = nowFn() - generationStartedAt;
      const budgetExceeded = timeout !== undefined && elapsedMs > timeout * 0.5;

      if (budgetExceeded) {
        logger.warn(
          {
            tickerId: context.tickerId,
            elapsedMs,
            timeoutMs: timeout,
            event: "brainstorm_slow_single_pass_fallback",
          },
          "Brainstorm pass consumed more than half the LLM timeout budget; skipping memo for structured pass",
        );
      } else if (brainstormResult.text.trim().length > 0) {
        brainstormText = brainstormResult.text.trim();
        brainstormUsed = true;
        logger.info(
          {
            tickerId: context.tickerId,
            brainstormLatencyMs: nowFn() - brainstormStartedAt,
            brainstormPromptTokens,
            brainstormCompletionTokens,
          },
          "Newsletter brainstorm pass complete",
        );
      }
    } catch (brainstormErr) {
      logger.warn(
        {
          tickerId: context.tickerId,
          event: "brainstorm_failed_fallback",
          err: brainstormErr,
        },
        "Newsletter brainstorm pass failed; falling back to single-pass generation",
      );
    }
  }

  // Apply placeholder substitution to the system prompt so {{topNewsCount}},
  // {{tickerName}}, and {{tickerSymbol}} are resolved before the LLM call.
  const rawSystemPrompt = config.prompts?.systemPrompt || SYSTEM_PROMPT;
  const substitutedSystemPrompt = rawSystemPrompt
    .replaceAll("{{topNewsCount}}", String(effectiveTopNewsCount))
    .replaceAll("{{tickerId}}", context.tickerId)
    .replaceAll("{{tickerName}}", context.tickerName ?? context.tickerId)
    .replaceAll("{{tickerSymbol}}", context.tickerSymbol ?? context.tickerId);
  const systemPrompt = applyContractBrief(
    substitutedSystemPrompt,
    context.brief !== undefined ? { brief: context.brief } : undefined,
  );

  const numericAnchors = config.inputs.numericAnchors;
  let numericAnchorSection = "";
  let topNumericAnchors: ReturnType<typeof selectTopAnchors> = [];
  let anchorsExtracted = 0;

  if (numericAnchors.enabled) {
    const extracted = extractNumericAnchorsFromSources(promptSources);
    anchorsExtracted = extracted.length;
    topNumericAnchors = selectTopAnchors(
      extracted,
      numericAnchors.perArticleCap,
      numericAnchors.totalCap,
    );
    numericAnchorSection = formatAnchorsForPrompt(topNumericAnchors);
  }

  const crossRunDedup = config.quality.crossRunDedup;
  const recentBullets = context.recentBullets ?? [];
  const crossRunDedupAvoidanceSection = crossRunDedup.enabled
    ? formatRecentBulletsAvoidanceBlock(recentBullets, crossRunDedup.windowDays)
    : "";

  const competitiveFocusConfig = config.quality.competitiveFocus;
  const promptCompetitors = (context.competitors ?? []).slice(
    0,
    competitiveFocusConfig.maxCompetitorsInPrompt,
  );
  const competitorSection = buildCompetitorPromptBlock(
    promptCompetitors,
    context.tickerName ?? context.tickerId,
  );

  const userTemplate =
    config.prompts?.userPromptTemplate || DEFAULT_USER_PROMPT_TEMPLATE;
  const prompt = buildUserPrompt(
    promptSources,
    userTemplate,
    {
      tickerId: context.tickerId,
      date: context.date,
      topNewsCount: effectiveTopNewsCount,
      tickerName: context.tickerName,
      tickerSymbol: context.tickerSymbol,
    },
    {
      exemplarSection,
      brainstormText,
      crossRunDedupAvoidanceSection,
      competitorSection,
      numericAnchorSection,
    },
  );

  const structuredTimeout =
    timeout !== undefined && brainstormUsed
      ? Math.max(1, timeout - (nowFn() - generationStartedAt))
      : timeout;

  // Reasoning tokens are consumed from the output budget. When using a
  // reasoning model, ensure credentials.maxTokens is large enough to
  // accommodate both reasoning tokens and the structured JSON output.
  // See the config reference for recommended pairings.
  const structuredProviderOptions = buildOpenAiReasoningProviderOptions(
    config.structuredReasoningEffort,
  );

  logger.info(
    {
      tickerId: context.tickerId,
      structuredReasoningEffort: config.structuredReasoningEffort,
      brainstormReasoningEffort: config.brainstormReasoningEffort,
      critiqueReasoningEffort: config.critiqueReasoningEffort,
      subjectLineReasoningEffort: config.subjectLineReasoningEffort,
    },
    "LLM passes: effective reasoning effort per pass",
  );

  const result = await retryWithBackoff(
    async () => {
      return generateFn({
        model,
        schema: industryNewsletterStructureLlmSchema,
        system: systemPrompt,
        prompt,
        maxRetries: 0,
        ...(structuredTimeout !== undefined
          ? { timeout: structuredTimeout }
          : {}),
        ...(maxTokens !== undefined ? { maxTokens } : {}),
        ...(structuredProviderOptions !== undefined
          ? { providerOptions: structuredProviderOptions }
          : {}),
      });
    },
    config.reliability.llmRetry,
    isRetryableLlmError,
    { sleepFn: deps.sleepFn },
  );

  const { object, usage } = result;

  if (fewShot.enabled && activeExemplars.length > 0) {
    const plagiarismCheck = detectExemplarPlagiarism(
      object,
      activeExemplars[0]!,
    );
    if (plagiarismCheck.possiblyPlagiarized) {
      logger.warn(
        {
          tickerId: context.tickerId,
          exemplarId: activeExemplars[0]!.id,
          maxJaccardSimilarity: plagiarismCheck.maxSimilarity,
          event: "newsletter_possibly_plagiarized_exemplar",
        },
        "Generated newsletter bullets overlap heavily with few-shot exemplar text",
      );
    }
  }

  let workingStructure = object;
  let numericAnchorSummary: NumericAnchorSummary | undefined;
  let citationGroundingReports: BulletGroundingReport[] | undefined;
  let citationGroundingSummary: CitationGroundingSummary | undefined;

  if (numericAnchors.enabled) {
    const applied = applyNumericAnchorPolicy(
      workingStructure,
      promptSources,
      topNumericAnchors,
      anchorsExtracted,
      numericAnchors.unmatchedPolicy,
    );
    workingStructure = applied.structure;
    numericAnchorSummary = applied.report;

    for (const figure of applied.strippedFigures) {
      logger.info(
        {
          tickerId: context.tickerId,
          event: "numeric_stripped",
          figure,
        },
        "Numeric figure stripped from briefing — not found in sources",
      );
    }

    logger.info(
      {
        tickerId: context.tickerId,
        anchorsExtracted: applied.report.anchorsExtracted,
        anchorsTopSelected: applied.report.anchorsTopSelected,
        anchorsQuotedVerbatim: applied.report.anchorsQuotedVerbatim,
        anchorCoverageRatio: applied.report.anchorCoverageRatio,
        unmatchedFigures: applied.report.unmatchedFigures.length,
      },
      "Numeric anchor coverage summary",
    );
  }

  let critiquedStructure = workingStructure;
  let critiqueSummary: NewsletterCritiqueSummary | undefined;
  let critiqueSkippedDueToBudget = false;
  let critiqueFailed = false;

  const selfCritique = config.quality.selfCritique;
  const runElapsedMs = nowFn() - (context.runStartedAt ?? generationStartedAt);
  const critiqueBudgetExceeded =
    timeout !== undefined && runElapsedMs > timeout * 0.7;

  if (selfCritique.enabled) {
    if (critiqueBudgetExceeded) {
      critiqueSkippedDueToBudget = true;
      logger.info(
        {
          tickerId: context.tickerId,
          runElapsedMs,
          timeoutMs: timeout,
          event: "critiqueSkippedDueToBudget",
        },
        "Self-critique skipped — run exceeded 70% of LLM timeout budget",
      );
    } else {
      const bulletCount = countNewsletterCritiqueBullets(workingStructure);
      if (bulletCount < selfCritique.minBulletCount) {
        critiqueSummary = {
          bulletsRated: 0,
          bulletsRewritten: 0,
          bulletsDropped: 0,
          floorPreserved: 0,
          promptTokens: null,
          completionTokens: null,
          p50Specificity: 0,
          p50ReaderValue: 0,
        };
      } else {
        const candidates =
          collectNewsletterCritiqueCandidates(workingStructure);
        const critiqueSystem = buildNewsletterCritiqueSystemPrompt();
        const critiquePrompt = buildNewsletterCritiqueUserPrompt({
          tickerName: context.tickerName,
          tickerSymbol: context.tickerSymbol,
          sources: promptSources,
          candidates,
        });
        const critiqueTimeout =
          timeout !== undefined
            ? Math.max(1, timeout - (nowFn() - generationStartedAt))
            : undefined;

        // The critic emits one JSON row per candidate, so a fixed token cap
        // truncates (and fails to parse) on larger briefings. Scale the budget
        // with candidate count while honoring the configured value as a floor.
        const critiqueMaxOutputTokens = Math.max(
          selfCritique.critiqueMaxOutputTokens,
          CRITIQUE_TOKENS_BASE_OVERHEAD +
            candidates.length * CRITIQUE_TOKENS_PER_CANDIDATE,
        );

        const critiqueProviderOptions = buildOpenAiReasoningProviderOptions(
          config.critiqueReasoningEffort,
        );

        try {
          const critiqueResult = await critiqueNewsletter(
            {
              apiKey: config.credentials.openaiApiKey,
              ...(config.credentials.baseUrl !== undefined
                ? { baseUrl: config.credentials.baseUrl }
                : {}),
              model: config.critiqueModel,
              maxOutputTokens: critiqueMaxOutputTokens,
              system: critiqueSystem,
              prompt: critiquePrompt,
              ...(critiqueTimeout !== undefined
                ? { timeout: critiqueTimeout }
                : {}),
              ...(critiqueProviderOptions !== undefined
                ? { providerOptions: critiqueProviderOptions }
                : {}),
            },
            { generateObjectFn: deps.critiqueGenerateObjectFn },
          );

          const applied = applyNewsletterCritiqueResults(
            workingStructure,
            critiqueResult.object.ratings,
            {
              dropFraction: selfCritique.dropFraction,
              preferRewriteOverDrop: selfCritique.preferRewriteOverDrop,
            },
          );

          critiquedStructure = applied.structure;

          if (applied.summary.floorPreserved > 0) {
            logger.info(
              {
                tickerId: context.tickerId,
                floorPreserved: applied.summary.floorPreserved,
                event: "critiqueFloorPreserved",
              },
              "Self-critique preserved schema row minimums",
            );
          }

          critiqueSummary = {
            ...applied.summary,
            promptTokens: critiqueResult.usage.promptTokens,
            completionTokens: critiqueResult.usage.completionTokens,
            p50Specificity: applied.p50Specificity,
            p50ReaderValue: applied.p50ReaderValue,
          };

          logger.info(
            {
              tickerId: context.tickerId,
              critique: critiqueSummary,
            },
            "Newsletter self-critique summary",
          );
        } catch (critiqueErr) {
          // The critique pass only drops/rewrites a bounded fraction of an
          // already-complete newsletter, so a failed critique (e.g. truncated
          // JSON) must never sink the run. Fall back to the un-critiqued
          // structure, matching the brainstorm and subject-line passes.
          critiqueFailed = true;
          critiquedStructure = workingStructure;
          logger.warn(
            {
              tickerId: context.tickerId,
              event: "self_critique_failed_fallback",
              err: critiqueErr,
            },
            "Newsletter self-critique pass failed; shipping un-critiqued bullets",
          );
        }
      }
    }
  }

  let polishedStructure = critiquedStructure;
  let polishSummary:
    | Pick<
        PolishNewsletterResult,
        "reports" | "totalReplacements" | "rulesFired"
      >
    | undefined;

  const polish = config.quality.polish;
  if (polish.enabled) {
    const polished = polishNewsletter(critiquedStructure, {
      tier: polish.tier,
      disabledRuleIds: polish.disabledRuleIds,
    });
    polishedStructure = polished.structure;
    polishSummary = {
      reports: polished.reports,
      totalReplacements: polished.totalReplacements,
      rulesFired: polished.rulesFired,
    };

    logger.info(
      {
        tickerId: context.tickerId,
        polishTier: polish.tier,
        rulesFired: polished.rulesFired,
        totalReplacements: polished.totalReplacements,
      },
      "Newsletter style polish summary",
    );
  }

  let focusGateStructure = polishedStructure;
  let competitiveFocusSummary: FocusSummary | undefined;

  if (
    competitiveFocusConfig.enabled &&
    (context.competitors?.length ?? 0) > 0
  ) {
    const focusResult = enforceCompetitiveFocus(polishedStructure, {
      competitors: context.competitors!.map((competitor) => ({
        name: competitor.name,
      })),
      issuerAliases: context.issuerAliases ?? [],
      policy: competitiveFocusConfig.policy,
      requireCitationEnabled: config.quality.requireCitation.enabled,
    });
    focusGateStructure = focusResult.structure;
    competitiveFocusSummary = focusResult.summary;

    logger.info(
      {
        tickerId: context.tickerId,
        competitorCount: focusResult.summary.competitorCount,
        evaluated: focusResult.summary.evaluated,
        dropped: focusResult.summary.dropped,
        flagged: focusResult.summary.flagged,
        policy: competitiveFocusConfig.policy,
      },
      "Competitive-focus gate summary",
    );
  }

  let groundedStructure = focusGateStructure;
  const citationGrounding = config.quality.citationGrounding;
  if (citationGrounding.enabled) {
    const grounded = groundNewsletterCitations(
      polishedStructure,
      promptSources,
      {
        policy: citationGrounding.policy,
        minOverlapScore: citationGrounding.minOverlapScore,
        numericBonus: citationGrounding.numericBonus,
      },
    );
    groundedStructure = grounded.structure;
    citationGroundingReports = grounded.reports;
    citationGroundingSummary = grounded.summary;

    if (grounded.quickHitsKeptDespiteFailedGrounding > 0) {
      logger.warn(
        {
          tickerId: context.tickerId,
          keptCount: grounded.quickHitsKeptDespiteFailedGrounding,
          event: "quickHits_ground_failed_keeping_item",
        },
        "Quick hits below grounding threshold kept to satisfy schema minimum",
      );
    }

    if (grounded.summary.floorPreserved > 0) {
      logger.info(
        {
          tickerId: context.tickerId,
          floorPreserved: grounded.summary.floorPreserved,
          event: "groundingFloorPreserved",
        },
        "Citation grounding downgraded drops to preserve schema row minimums",
      );
    }

    logger.info(
      {
        tickerId: context.tickerId,
        groundingPolicy: citationGrounding.policy,
        totalCitations: grounded.summary.totalCitations,
        unlinked: grounded.summary.unlinked,
        dropped: grounded.summary.dropped,
        floorPreserved: grounded.summary.floorPreserved,
        p50Overlap: grounded.summary.p50Overlap,
        p10Overlap: grounded.summary.p10Overlap,
      },
      "Citation grounding summary",
    );
  }

  let finalStructure = groundedStructure;
  let preheader: string | undefined;
  let subjectLineSummary: SubjectLineSummary | undefined;

  const subjectLine = config.delivery.subjectLine;
  const recentSubjects = context.recentSubjects ?? [];

  if (subjectLine.enabled) {
    const originalSubject =
      critiquedStructure.subject.trim().length > 0
        ? critiquedStructure.subject.trim()
        : "Your daily briefing";

    try {
      const subjectSystem = buildSubjectCandidateSystemPrompt(
        subjectLine.candidateCount,
      );
      const subjectPrompt = buildSubjectCandidatePrompt({
        tickerName: context.tickerName,
        tickerSymbol: context.tickerSymbol,
        primarySubject: originalSubject,
        candidateCount: subjectLine.candidateCount,
        ...(brainstormText !== undefined ? { brainstormText } : {}),
      });

      const subjectTimeout =
        timeout !== undefined
          ? Math.max(1, timeout - (nowFn() - generationStartedAt))
          : undefined;

      const subjectProviderOptions = buildOpenAiReasoningProviderOptions(
        config.subjectLineReasoningEffort,
      );

      const subjectResult = await fetchSubjectCandidates(
        {
          apiKey: config.credentials.openaiApiKey,
          ...(config.credentials.baseUrl !== undefined
            ? { baseUrl: config.credentials.baseUrl }
            : {}),
          model: config.subjectLineModel,
          candidateCount: subjectLine.candidateCount,
          system: subjectSystem,
          prompt: subjectPrompt,
          ...(subjectTimeout !== undefined ? { timeout: subjectTimeout } : {}),
          ...(subjectProviderOptions !== undefined
            ? { providerOptions: subjectProviderOptions }
            : {}),
        },
        { generateObjectFn: deps.subjectGenerateObjectFn },
      );

      const picked = pickBestSubject(
        subjectResult.object.candidates,
        originalSubject,
        polishedStructure.industryPulse.prose,
        {
          tickerSymbol: context.tickerSymbol,
          tickerName: context.tickerName,
          weights: subjectLine.weights,
          recentSubjects,
        },
      );

      finalStructure = {
        ...critiquedStructure,
        subject: picked.winnerSubject,
      };
      preheader = picked.winnerPreheader;

      subjectLineSummary = {
        originalSubject,
        winnerSubject: picked.winnerSubject,
        winnerScore: picked.winnerScore,
        originalScore: picked.originalScore,
        candidateCount: subjectResult.object.candidates.length,
        candidateScores: picked.rankedTable
          .filter((row) => row.candidate.subject !== originalSubject)
          .map((row) => ({
            subject: row.candidate.subject,
            style: row.candidate.style,
            score: row.score,
          })),
        promptTokens: subjectResult.usage.promptTokens,
        completionTokens: subjectResult.usage.completionTokens,
      };

      logger.info(
        {
          tickerId: context.tickerId,
          originalSubject,
          winnerSubject: picked.winnerSubject,
          winnerScore: picked.winnerScore,
          originalScore: picked.originalScore,
          candidateCount: subjectResult.object.candidates.length,
          candidateScores: subjectLineSummary.candidateScores,
        },
        "Subject line candidate ranking",
      );
    } catch (subjectErr) {
      logger.warn(
        {
          tickerId: context.tickerId,
          event: "subject_line_failed_fallback",
          err: subjectErr,
        },
        "Subject line candidate pass failed; keeping structured-pass subject",
      );
    }
  }

  let crossRunDedupSummary:
    | ReturnType<typeof buildCrossRunDedupObservability>
    | undefined;
  let lowInformationDay: boolean | undefined;

  if (crossRunDedup.enabled) {
    const deduped = dedupBullets(finalStructure, recentBullets, {
      policy: crossRunDedup.policy,
      minSimilarity: crossRunDedup.minSimilarity,
      lowInfoDayThreshold: crossRunDedup.lowInfoDayThreshold,
    });
    finalStructure = deduped.structure;
    lowInformationDay = deduped.lowInformationDay;
    crossRunDedupSummary = buildCrossRunDedupObservability(
      deduped,
      recentBullets.length,
    );

    if (deduped.floorPreserved > 0) {
      logger.info(
        {
          tickerId: context.tickerId,
          floorPreserved: deduped.floorPreserved,
          event: "dedupFloorPreserved",
        },
        "Cross-run dedup downgraded drops to preserve schema row minimums",
      );
    }

    logger.info(
      {
        tickerId: context.tickerId,
        ...crossRunDedupSummary,
      },
      "Cross-run newsletter dedup summary",
    );
  }

  let resolved = attachIndustryNewsletterSourceUrls(
    finalStructure,
    promptSources,
  );

  let requireCitationSummary: PruneSummary | undefined;
  let prunedSectionsRemoved: NewsletterSectionId[] = [];
  const requireCitation = config.quality.requireCitation;
  if (requireCitation.enabled) {
    if (citationGrounding.enabled) {
      logger.info(
        {
          tickerId: context.tickerId,
          groundingPolicy: citationGrounding.policy,
        },
        "Citation grounding and require-citation pruning are both enabled; unlinked bullets will be pruned",
      );
    }

    const pruned = pruneNewsletterToCitedRows(resolved, {
      sections: requireCitation.sections,
      dedupeArticlesWithinSection: requireCitation.dedupeArticlesWithinSection,
      dedupeScope: requireCitation.dedupeScope,
    });
    resolved = pruned.resolved;
    requireCitationSummary = pruned.summary;
    prunedSectionsRemoved = pruned.reports
      .filter((report) => report.sectionRemoved)
      .map((report) => report.sectionKey as NewsletterSectionId);

    logger.info(
      {
        tickerId: context.tickerId,
        sectionsRemoved: pruned.summary.sectionsRemoved,
        bulletsRemovedUncited: pruned.summary.bulletsRemovedUncited,
        bulletsRemovedDuplicate: pruned.summary.bulletsRemovedDuplicate,
        sectionsKept: pruned.summary.sectionsKept,
      },
      "Require-citation pruning summary",
    );
  }

  const content = formatIndustryNewsletterWire(resolved);

  return {
    subject:
      finalStructure.subject !== undefined &&
      finalStructure.subject.trim().length > 0
        ? finalStructure.subject.trim()
        : "Your daily briefing",
    content,
    // Reads the pre-prune finalStructure, so this is safe even when the resolved
    // lead was later removed by the require-citation pass.
    description: finalStructure.industryPulse.prose.trim() || undefined,
    promptTokens: usage?.promptTokens ?? null,
    completionTokens: usage?.completionTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
    systemPrompt,
    resolvedUserPrompt: prompt,
    brainstormUsed,
    brainstormPromptTokens,
    brainstormCompletionTokens,
    ...(usage?.reasoningTokens !== undefined
      ? { structuredReasoningTokens: usage.reasoningTokens }
      : {}),
    ...(citationGroundingReports !== undefined
      ? { citationGroundingReports }
      : {}),
    ...(citationGroundingSummary !== undefined
      ? { citationGroundingSummary }
      : {}),
    ...(numericAnchorSummary !== undefined ? { numericAnchorSummary } : {}),
    ...(preheader !== undefined ? { preheader } : {}),
    ...(subjectLineSummary !== undefined ? { subjectLineSummary } : {}),
    ...(crossRunDedupSummary !== undefined ? { crossRunDedupSummary } : {}),
    ...(lowInformationDay !== undefined ? { lowInformationDay } : {}),
    ...(critiqueSummary !== undefined ? { critiqueSummary } : {}),
    ...(critiqueSkippedDueToBudget ? { critiqueSkippedDueToBudget: true } : {}),
    ...(critiqueFailed ? { critiqueFailed: true } : {}),
    ...(polishSummary !== undefined ? { polishSummary } : {}),
    ...(requireCitationSummary !== undefined ? { requireCitationSummary } : {}),
    ...(competitiveFocusSummary !== undefined
      ? { competitiveFocusSummary }
      : {}),
    sectionFillSnapshot: {
      bySection: computeNewsletterSectionFill(resolved),
      sectionsRemoved: prunedSectionsRemoved,
    },
  };
}
