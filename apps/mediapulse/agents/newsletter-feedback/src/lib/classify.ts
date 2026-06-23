import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import {
  feedbackCategorySchema,
  feedbackSentimentSchema,
  type FeedbackCategory,
  type FeedbackSentiment,
} from "@workspace/agent-data-api-contract";

/** Structured classification the model is asked to produce. */
export const feedbackClassificationSchema = z.object({
  sentiment: feedbackSentimentSchema,
  category: feedbackCategorySchema,
  confidence: z.number().min(0).max(1).optional(),
});

export type FeedbackClassification = {
  sentiment: FeedbackSentiment;
  category: FeedbackCategory;
  confidence?: number;
};

const SYSTEM_PROMPT = [
  "You classify replies that newsletter subscribers send back to a financial newsletter.",
  "Return the overall sentiment and the single best-fit category for the reader's message.",
  "sentiment: positive | negative | neutral | mixed.",
  "category: praise | complaint | feature_request | bug | question | other.",
  "Judge only the reader's own words; ignore quoted newsletter content and signatures.",
].join(" ");

/**
 * Injectable `generateObject` call so the run handler can be tested without
 * hitting the network.
 */
export type GenerateObjectForClassification = (args: {
  apiKey: string;
  model: string;
  baseUrl?: string;
  replyText: string;
}) => Promise<FeedbackClassification>;

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Classifies a reply's sentiment and category via the OpenAI-compatible provider.
 *
 * @param args.apiKey - Provider API key (`config.model.apiKey`).
 * @param args.model - Model id (`config.model.model`).
 * @param args.baseUrl - Optional OpenAI-compatible base URL.
 * @param args.replyText - De-quoted reply text to classify.
 */
export const classifyFeedback: GenerateObjectForClassification = async ({
  apiKey,
  model,
  baseUrl,
  replyText,
}) => {
  const openai = createOpenAI({
    apiKey,
    ...(baseUrl !== undefined ? { baseURL: baseUrl } : {}),
  });

  const result = await generateObject({
    model: openai(model),
    schema: feedbackClassificationSchema,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: replyText },
    ],
  });

  return result.object;
};
