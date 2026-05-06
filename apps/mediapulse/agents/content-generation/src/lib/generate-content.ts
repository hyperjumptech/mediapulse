import OpenAI from "openai";

import { formatNewsletterContent } from "../format-newsletter-content.js";
import { parseNewsletterJson } from "../parse-newsletter-json.js";
import type { SourceForGeneration } from "../types.js";
import { truncateSources } from "./truncate-sources.js";

export const DEFAULT_SYSTEM_PROMPT = `You are a newsletter writer for busy executives. Given numbered article summaries, produce a structured newsletter.

Return a JSON object with:
- "subject": a compelling email subject line (short, under ~60 chars).
- "executiveSummary": 2–3 sentences summarizing the main themes and why they matter. No bullet points; use clear prose.
- "topNews": an array of exactly {{topNewsCount}} items in the same order as the numbered articles. Each item must have:
  - "title": short headline capturing the key point of that article
  - "summary": 2–4 plain sentences summarizing the article. Do not include any markdown links or citation markers.`;

export const DEFAULT_USER_PROMPT_TEMPLATE =
  "Create a newsletter from the {{topNewsCount}} articles below. Write exactly one top-news item per numbered article, in the same order.\n\n{{sourceSummaries}}";

/**
 * Calls OpenAI to generate a newsletter with an executive summary and top news items.
 *
 * Template placeholders supported in systemPrompt / userPromptTemplate:
 *   {{topNewsCount}}    - number of top-news items requested
 *   {{sourceSummaries}} - concatenated (post-truncation) source text
 *   {{tickerId}}        - ticker symbol from the pipeline input
 *   {{date}}            - current date in YYYY-MM-DD format
 *
 * @param sources - Fetched articles/sources to summarize.
 * @param deps - OpenAI client, model, and config for truncation/output.
 * @returns Subject and formatted plain-text content for the newsletter.
 */
export async function generateContentWithOpenAI(
  sources: SourceForGeneration[],
  deps: {
    openai: OpenAI;
    model: string;
    maxTokens?: number;
    topNewsCount: number;
    maxCharsPerSource: number;
    maxTotalContextChars: number;
    systemPrompt?: string;
    userPromptTemplate?: string;
    /** Ticker symbol forwarded to {{tickerId}} in custom prompt templates. */
    tickerId?: string;
    /** Current date (YYYY-MM-DD) forwarded to {{date}} in custom prompt templates. */
    date?: string;
  },
): Promise<{ subject: string; content: string; description?: string }> {
  const truncated = truncateSources(
    sources,
    deps.maxCharsPerSource,
    deps.maxTotalContextChars,
  );

  const sourceSummaries = truncated
    .map((source, i) => `Article ${i + 1}: ${source.title}\n${source.content}`)
    .join("\n\n---\n\n");

  const replacePlaceholders = (template: string): string =>
    template
      .replace(/\{\{topNewsCount\}\}/g, String(deps.topNewsCount))
      .replace(/\{\{tickerId\}\}/g, deps.tickerId ?? "")
      .replace(/\{\{date\}\}/g, deps.date ?? "")
      .replace(/\{\{sourceSummaries\}\}/g, sourceSummaries);

  const systemPrompt = replacePlaceholders(
    deps.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
  );
  const userContent = replacePlaceholders(
    deps.userPromptTemplate ?? DEFAULT_USER_PROMPT_TEMPLATE,
  );

  const response = await deps.openai.chat.completions.create({
    model: deps.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    max_tokens: deps.maxTokens,
  });

  const result = response.choices[0]?.message?.content;

  if (!result) {
    throw new Error("OpenAI returned an empty response");
  }

  const validated = parseNewsletterJson(result, deps.topNewsCount);
  const topNews = Array.isArray(validated.topNews)
    ? validated.topNews.slice(0, deps.topNewsCount)
    : [];
  const content = formatNewsletterContent(
    validated.executiveSummary ?? "",
    topNews.map((item) => ({
      title: item.title,
      summary: item.summary,
    })),
    deps.topNewsCount,
  );

  return {
    subject: validated.subject ?? "Your daily briefing",
    content,
    description: validated.executiveSummary?.trim() || undefined,
  };
}
