import { createOpenAI } from "@ai-sdk/openai";
import type { NewsletterDocument } from "@workspace/email-templates/newsletter-document";
import { readNewsletterDocument } from "@workspace/email-templates/newsletter-document";
import { generateObject } from "ai";
import { z } from "zod";

/** Target language codes the translation pass supports (non-English only). */
export type TranslationTargetLanguage = "id";

const LANGUAGE_NAMES: Record<TranslationTargetLanguage, string> = {
  id: "Indonesian (Bahasa Indonesia)",
};

/** Structured output the model must return for a translated newsletter. */
const translatedNewsletterSchema = z.object({
  subject: z.string().min(1),
  strings: z.array(z.string()),
});

/** Credentials needed to reach the OpenAI-compatible endpoint. */
export type TranslationCredentials = {
  openaiApiKey: string;
  baseUrl?: string;
};

/** Arguments for a single translation `generateObject` call. */
export type TranslateNewsletterObjectArgs = {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof translatedNewsletterSchema;
  system: string;
  prompt: string;
  /** Should always be 0 — retries are managed by the caller. */
  maxRetries: number;
};

/** Token usage from a translation `generateObject` response. */
export type TranslateNewsletterUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

/** Result of translating one newsletter into one target language. */
export type TranslateNewsletterResult = {
  subject: string;
  content: string;
} & TranslateNewsletterUsage;

/** Injectable wrapper around `generateObject` so tests can substitute the model call. */
export type TranslateNewsletterObjectFn = (
  args: TranslateNewsletterObjectArgs,
) => Promise<{
  object: z.infer<typeof translatedNewsletterSchema>;
  usage?: { inputTokens?: number; outputTokens?: number };
}>;

/** Raised when the body is not a valid newsletter document or the model broke the string count. */
export class TranslateNewsletterError extends Error {}

const defaultTranslateNewsletterObject: TranslateNewsletterObjectFn = async (
  args,
) => {
  const result = await generateObject({ ...args });
  const usage =
    result.usage !== undefined
      ? {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        }
      : undefined;

  return { object: result.object, usage };
};

/**
 * Collects every translatable leaf string of a document, in document order.
 *
 * URLs, bylines, and section keys are excluded: they are grounded data, not copy.
 *
 * @param document - Parsed newsletter document.
 * @returns Article titles and points, in the order {@link rebuildWithTranslatedStrings} consumes them.
 */
export const collectTranslatableStrings = (
  document: NewsletterDocument,
): string[] => {
  const strings: string[] = [];
  for (const section of document.sections) {
    for (const article of section.articles) {
      strings.push(article.title);
      strings.push(...article.points);
    }
  }

  return strings;
};

/**
 * Rebuilds a document with translated leaf strings substituted in place.
 *
 * @param document - The source document.
 * @param translated - Translated strings in {@link collectTranslatableStrings} order.
 * @returns A document identical to the source apart from its title and point text.
 * @throws `TranslateNewsletterError` when `translated` does not match the source string count.
 */
export const rebuildWithTranslatedStrings = (
  document: NewsletterDocument,
  translated: readonly string[],
): NewsletterDocument => {
  const expectedCount = collectTranslatableStrings(document).length;
  if (translated.length !== expectedCount) {
    throw new TranslateNewsletterError(
      `Translation returned ${String(translated.length)} strings, expected ${String(expectedCount)}`,
    );
  }

  let cursor = 0;

  return {
    version: 1,
    sections: document.sections.map((section) => ({
      key: section.key,
      articles: section.articles.map((article) => {
        const title = translated[cursor];
        cursor += 1;
        const points = article.points.map(() => {
          const point = translated[cursor];
          cursor += 1;

          return point ?? "";
        });

        return {
          ...article,
          title: title ?? article.title,
          points,
        };
      }),
    })),
  };
};

/**
 * Builds the system prompt that constrains the translation to a positional string array.
 *
 * @param languageName - Human-readable target language name.
 */
function buildTranslationSystemPrompt(languageName: string): string {
  return [
    `You are a professional financial-newsletter translator. Translate into ${languageName}.`,
    "You receive a subject line and a numbered list of short strings from one newsletter.",
    'Return {"subject", "strings"} where "strings" has EXACTLY the same number of entries as the input, in the same order, each entry the translation of the input entry at that position.',
    "Never merge, split, drop, add, or reorder entries. Translate each entry independently.",
    "Translate faithfully and naturally, in the same tone and register.",
    "Keep every number, percentage, currency figure, date, ticker symbol, and proper noun exactly as written; do not localize, convert, or round them.",
  ].join(" ");
}

/**
 * Translates a stored newsletter document into a target language.
 *
 * The document is parsed, its leaf strings are translated as a positional array, and the document
 * is rebuilt around them, so structure preservation is arithmetic rather than a model instruction.
 * URLs, bylines, and section keys are never sent for translation.
 *
 * @param params - Source subject/content, target language, model, and credentials.
 * @param generateObjectFn - Injectable model call (defaults to the AI SDK wrapper).
 * @returns Translated subject/content and token usage.
 * @throws `TranslateNewsletterError` when the body is not a valid document or the count mismatches.
 */
export async function translateNewsletter(
  params: {
    subject: string;
    content: string;
    targetLanguage: TranslationTargetLanguage;
    model: string;
    credentials: TranslationCredentials;
  },
  generateObjectFn: TranslateNewsletterObjectFn = defaultTranslateNewsletterObject,
): Promise<TranslateNewsletterResult> {
  const document = readNewsletterDocument(params.content);
  if (document === undefined) {
    throw new TranslateNewsletterError(
      "Newsletter body is not a valid newsletter document",
    );
  }

  const sourceStrings = collectTranslatableStrings(document);

  const openai = createOpenAI({
    apiKey: params.credentials.openaiApiKey,
    ...(params.credentials.baseUrl
      ? { baseURL: params.credentials.baseUrl }
      : {}),
  });
  const model = openai(params.model);
  const languageName = LANGUAGE_NAMES[params.targetLanguage];
  const system = buildTranslationSystemPrompt(languageName);
  const numberedStrings = sourceStrings
    .map((value, index) => `${String(index + 1)}. ${value}`)
    .join("\n");
  const prompt = [
    `Translate the following newsletter. Return exactly ${String(sourceStrings.length)} strings.`,
    "",
    `SUBJECT:\n${params.subject}`,
    "",
    `STRINGS:\n${numberedStrings}`,
  ].join("\n");

  const result = await generateObjectFn({
    model,
    schema: translatedNewsletterSchema,
    system,
    prompt,
    maxRetries: 0,
  });

  const translatedDocument = rebuildWithTranslatedStrings(
    document,
    result.object.strings,
  );

  const inputTokens = result.usage?.inputTokens;
  const outputTokens = result.usage?.outputTokens;
  const totalTokens =
    inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : null;

  return {
    subject: result.object.subject,
    content: JSON.stringify(translatedDocument),
    promptTokens: inputTokens ?? null,
    completionTokens: outputTokens ?? null,
    totalTokens,
  };
}
