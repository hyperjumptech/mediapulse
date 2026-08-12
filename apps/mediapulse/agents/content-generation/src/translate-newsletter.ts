import { createOpenAI } from "@ai-sdk/openai";
import type { NewsletterDocument } from "@workspace/email-templates/newsletter-document";
import {
  MAX_POINT_LENGTH,
  newsletterDocumentSchema,
  readNewsletterDocument,
} from "@workspace/email-templates/newsletter-document";
import { generateObject } from "ai";
import { z } from "zod";

import {
  sanitizeSummaryPoints,
  type DroppedPoint,
} from "./lib/sanitize-summary-points.js";

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
  /** Points the translation pass broke, removed before the document was validated. */
  droppedPoints: DroppedPoint[];
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
export type TranslatableEntry = {
  text: string;
  maxLength?: number;
};

export const collectTranslatableEntries = (
  document: NewsletterDocument,
): TranslatableEntry[] => {
  const entries: TranslatableEntry[] = [];
  for (const section of document.sections) {
    for (const article of section.articles) {
      entries.push({ text: article.title });
      for (const point of article.points) {
        entries.push({ text: point, maxLength: MAX_POINT_LENGTH });
      }
    }
  }

  return entries;
};

export const collectTranslatableStrings = (
  document: NewsletterDocument,
): string[] => collectTranslatableEntries(document).map((entry) => entry.text);

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

export type PrunedTranslationResult = {
  document: NewsletterDocument;
  dropped: DroppedPoint[];
};

/**
 * Removes translated points that read as broken prose, along with anything left empty.
 *
 * - Important: the source document was sanitized before translation, so everything removed here
 *   was introduced by the translation pass itself. The model is given a per-point character
 *   budget as prompt text, and compresses to fit it by dropping a subject or cutting a clause.
 *
 * @param document - The translated document, before schema validation.
 * @returns The document with unusable points, articles, and sections removed, plus what was dropped.
 */
export const pruneUnusableTranslatedPoints = (
  document: NewsletterDocument,
): PrunedTranslationResult => {
  const dropped: DroppedPoint[] = [];
  const sections = document.sections
    .map((section) => ({
      key: section.key,
      articles: section.articles
        .map((article) => {
          const sanitized = sanitizeSummaryPoints(article.points);
          dropped.push(...sanitized.dropped);

          return { ...article, points: sanitized.points };
        })
        .filter((article) => article.points.length > 0),
    }))
    .filter((section) => section.articles.length > 0);

  return { document: { version: 1, sections }, dropped };
};

const buildEchoedIndexPrefixPattern = (index: number): RegExp =>
  new RegExp(`^\\s*${String(index + 1)}\\s*[.)]\\s+`);

export const stripEchoedIndexPrefixes = (
  sourceStrings: readonly string[],
  translated: readonly string[],
): string[] =>
  translated.map((value, index) => {
    const pattern = buildEchoedIndexPrefixPattern(index);
    const source = sourceStrings[index];
    if (source !== undefined && pattern.test(source)) {
      return value;
    }

    return value.replace(pattern, "");
  });

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
    "The leading numbers exist only to mark position; they are not part of the text. Never repeat a leading number in a returned entry.",
    "Never merge, split, drop, add, or reorder entries. Translate each entry independently.",
    "Translate faithfully and naturally, in the same tone and register.",
    `An entry tagged (max N chars) must translate to at most N characters, counting spaces. ${languageName} usually runs longer than English, so condense the wording — drop filler, use shorter synonyms, cut redundant qualifiers — rather than exceed the limit. Never return an empty entry.`,
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

  const sourceEntries = collectTranslatableEntries(document);
  const sourceStrings = sourceEntries.map((entry) => entry.text);

  const openai = createOpenAI({
    apiKey: params.credentials.openaiApiKey,
    ...(params.credentials.baseUrl
      ? { baseURL: params.credentials.baseUrl }
      : {}),
  });
  const model = openai(params.model);
  const languageName = LANGUAGE_NAMES[params.targetLanguage];
  const system = buildTranslationSystemPrompt(languageName);
  const numberedStrings = sourceEntries
    .map((entry, index) => {
      const budget =
        entry.maxLength === undefined
          ? ""
          : ` (max ${String(entry.maxLength)} chars)`;

      return `${String(index + 1)}.${budget} ${entry.text}`;
    })
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

  const cleanedStrings = stripEchoedIndexPrefixes(
    sourceStrings,
    result.object.strings,
  );
  const translatedDocument = rebuildWithTranslatedStrings(
    document,
    cleanedStrings,
  );
  const pruned = pruneUnusableTranslatedPoints(translatedDocument);
  const validated = newsletterDocumentSchema.safeParse(pruned.document);
  if (!validated.success) {
    const issues = validated.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new TranslateNewsletterError(
      `Translated document failed validation — ${issues}`,
    );
  }

  const inputTokens = result.usage?.inputTokens;
  const outputTokens = result.usage?.outputTokens;
  const totalTokens =
    inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : null;

  return {
    subject: result.object.subject,
    content: JSON.stringify(validated.data),
    droppedPoints: pruned.dropped,
    promptTokens: inputTokens ?? null,
    completionTokens: outputTokens ?? null,
    totalTokens,
  };
}
