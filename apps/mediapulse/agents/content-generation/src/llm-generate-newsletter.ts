import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { z } from "zod";

import type { ResolvedContentGenerationConfig } from "./config-schema.js";
import { formatNewsletterContent } from "./format-newsletter-content.js";
import { isRetryableLlmError } from "./llm-classify-error.js";
import { retryWithBackoff } from "./lib/retry.js";
import { newsletterStructureSchema } from "./parse-newsletter-json.js";

/** A single data source passed as input to the LLM for newsletter generation. */
export type SourceForGeneration = {
  url: string;
  title: string;
  content: string;
};

/** Structured newsletter content returned after a successful LLM call. */
export interface GeneratedContent {
  /** Compelling email subject line (under ~60 chars). */
  subject: string;
  /** Formatted plain-text newsletter body (executive summary + top 3 news). */
  content: string;
  /** Optional executive summary for newsletter preview or listing. */
  description?: string;
}

/** Minimal arguments for a single `generateObject` call for newsletter generation. */
export type GenerateNewsletterObjectArgs = {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof newsletterStructureSchema;
  system: string;
  prompt: string;
  /** Should always be 0 — we manage our own retry loop via retryWithBackoff. */
  maxRetries: number;
  /** Optional abort signal (e.g. from `AbortSignal.timeout()`) for per-request timeout. */
  signal?: AbortSignal;
};

/** Result of a single `generateObject` call for newsletter generation. */
export type GenerateNewsletterObjectResult = {
  object: z.infer<typeof newsletterStructureSchema>;
};

/** Injectable wrapper around `generateObject` to allow test substitution. */
export type GenerateNewsletterObjectFn = (
  args: GenerateNewsletterObjectArgs,
) => Promise<GenerateNewsletterObjectResult>;

const defaultGenerateNewsletterObject: GenerateNewsletterObjectFn = async (
  args,
) => {
  const result = await generateObject(args);
  return { object: result.object };
};

const SYSTEM_PROMPT = `You are a newsletter writer for busy executives. Given multiple data sources, produce a structured newsletter.

Return a JSON object with:
- "subject": a compelling email subject line (short, under ~60 chars).
- "executiveSummary": 2–3 sentences summarizing the main themes and why they matter. No bullet points; use clear prose.
- "topNews": an array of exactly 3 items. Each item has "title" (short headline) and "summary" (2–4 sentences). Pick the 3 most important or impactful stories. Keep summaries concise and actionable.`;

/**
 * Builds the LLM user prompt from the list of data sources.
 *
 * @param sources - Fetched articles/sources to include in the prompt.
 * @returns Formatted user-turn string for the LLM.
 */
function buildUserPrompt(sources: SourceForGeneration[]): string {
  const sourceSummaries = sources
    .map(
      (source) => `Source: ${source.title} (${source.url})\n${source.content}`,
    )
    .join("\n\n---\n\n");
  return `Create a newsletter from these data sources. Include an executive summary and the top 3 news items with brief summaries.\n\n${sourceSummaries}`;
}

/**
 * Generates newsletter content from data sources via the Vercel AI SDK with retry logic.
 *
 * Retries on transient errors (rate limits, server errors, timeouts) up to
 * `config.llmRetry.maxAttempts` times with exponential backoff and optional jitter.
 * Non-retryable errors (auth failure, bad request, schema validation) are thrown immediately.
 *
 * @param sources - Fetched data sources to summarise into a newsletter.
 * @param config - Resolved agent config including `llmRetry` and `openai.timeoutMs`.
 * @param deps - Injectable dependencies: `generateObjectFn` and `sleepFn` for testing.
 * @returns Generated newsletter subject, content body, and optional executive summary.
 * @throws `APICallError` | `TypeValidationError` | `NoObjectGeneratedError` on failure.
 */
export async function generateNewsletterWithLlm(
  sources: SourceForGeneration[],
  config: ResolvedContentGenerationConfig,
  deps: {
    generateObjectFn?: GenerateNewsletterObjectFn;
    sleepFn?: (ms: number) => Promise<void>;
  } = {},
): Promise<GeneratedContent> {
  const generateFn = deps.generateObjectFn ?? defaultGenerateNewsletterObject;

  const openai = createOpenAI({
    apiKey: config.openai.apiKey,
    ...(config.openai.baseUrl ? { baseURL: config.openai.baseUrl } : {}),
  });
  const model = openai(config.openai.model);
  const prompt = buildUserPrompt(sources);

  // Use AbortSignal.timeout() for per-request timeout so the timeout fires
  // reliably regardless of provider-level support for a `timeout` option.
  const signal = AbortSignal.timeout(config.openai.timeoutMs);

  const result = await retryWithBackoff(
    () =>
      generateFn({
        model,
        schema: newsletterStructureSchema,
        system: SYSTEM_PROMPT,
        prompt,
        maxRetries: 0,
        signal,
      }),
    config.llmRetry,
    isRetryableLlmError,
    { sleepFn: deps.sleepFn },
  );

  const { object } = result;
  const topNews = Array.isArray(object.topNews)
    ? object.topNews.slice(0, 3)
    : [];
  const content = formatNewsletterContent(
    object.executiveSummary ?? "",
    topNews,
  );

  return {
    subject: object.subject ?? "Your daily briefing",
    content,
    description: object.executiveSummary?.trim() || undefined,
  };
}
