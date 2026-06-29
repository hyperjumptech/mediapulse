import { createOpenAI } from "@ai-sdk/openai";
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
  content: z.string().min(1),
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
 * Builds the system prompt that constrains the translation to preserve the
 * newsletter wire structure, citation links, and numeric figures.
 *
 * @param languageName - Human-readable target language name.
 */
function buildTranslationSystemPrompt(languageName: string): string {
  return [
    `You are a professional financial-newsletter translator. Translate the newsletter into ${languageName}.`,
    "Translate the prose faithfully and naturally, in the same tone and register.",
    "Preserve the exact structure: keep every line break, section header, label, and bullet marker in the same positions.",
    "Keep all Markdown links intact — translate the visible [label] text but copy each (https://…) URL verbatim, unchanged.",
    "Keep every number, percentage, currency figure, date, ticker symbol, and proper noun exactly as written; do not localize, convert, or round them.",
    "Do not add, drop, summarize, or reorder any content. Return only the translated subject and content.",
  ].join(" ");
}

/**
 * Translates a generated newsletter into a target language, preserving the wire
 * structure, citation links, and numeric figures.
 *
 * @param params - Source subject/content, target language, model, and credentials.
 * @param generateObjectFn - Injectable model call (defaults to the AI SDK wrapper).
 * @returns Translated subject/content and token usage.
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
  const openai = createOpenAI({
    apiKey: params.credentials.openaiApiKey,
    ...(params.credentials.baseUrl
      ? { baseURL: params.credentials.baseUrl }
      : {}),
  });
  const model = openai(params.model);
  const languageName = LANGUAGE_NAMES[params.targetLanguage];
  const system = buildTranslationSystemPrompt(languageName);
  const prompt = [
    "Translate the following newsletter.",
    "",
    `SUBJECT:\n${params.subject}`,
    "",
    `CONTENT:\n${params.content}`,
  ].join("\n");

  const result = await generateObjectFn({
    model,
    schema: translatedNewsletterSchema,
    system,
    prompt,
    maxRetries: 0,
  });

  const inputTokens = result.usage?.inputTokens;
  const outputTokens = result.usage?.outputTokens;
  const totalTokens =
    inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : null;

  return {
    subject: result.object.subject,
    content: result.object.content,
    promptTokens: inputTokens ?? null,
    completionTokens: outputTokens ?? null,
    totalTokens,
  };
}
