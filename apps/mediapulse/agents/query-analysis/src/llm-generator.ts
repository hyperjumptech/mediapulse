/**
 * LLM-based query generator using OpenAI.
 *
 * Failure is non-fatal: any error returns an empty array so the deterministic
 * baseline still produces a usable set (FR7).
 */

import { logger } from "@workspace/logger";
import OpenAI from "openai";
import { z } from "zod";
import type { TickerContext } from "./deterministic-generator.js";

export type LlmQueryIntent = "breaking" | "kg_change" | "fundamental";

export interface LlmQuery {
  text: string;
  intent: LlmQueryIntent;
}

const llmQuerySchema = z.object({
  text: z.string().trim().min(1),
  intent: z.enum(["breaking", "kg_change", "fundamental"]),
});

const llmResponseSchema = z.array(llmQuerySchema);

/**
 * Calls OpenAI to generate additional search queries beyond the deterministic baseline.
 *
 * @param ticker - Ticker context to inform the prompt.
 * @param existingTexts - Already-generated texts to avoid duplication.
 * @param config - OpenAI client, model, token limit, and target count.
 * @returns Array of novel LLM-generated queries, or empty array on any failure.
 */
export async function generateLlmQueries(
  ticker: TickerContext,
  existingTexts: string[],
  config: {
    openai: OpenAI;
    model: string;
    maxTokens: number;
    targetCount: number;
  },
): Promise<LlmQuery[]> {
  const { openai, model, maxTokens, targetCount } = config;

  const entitySummary = ticker.topEntities
    .slice(0, 5)
    .map((e) => `${e.canonicalName} (${e.typeName})`)
    .join(", ");

  const themeSummary = ticker.recentThemes
    .slice(0, 5)
    .map((t) => t.theme)
    .join(", ");

  const existingList = existingTexts.slice(0, 20).join("\n");

  const systemPrompt = `You are a financial news search expert. Generate search queries for a stock ticker.
Return a JSON array of objects, each with "text" (the query string) and "intent" (one of: "breaking", "kg_change", "fundamental").
- "breaking": latest news, recent events, price movements
- "kg_change": relationship changes between entities (partnerships, acquisitions, leadership changes)
- "fundamental": earnings, guidance, regulatory, financial metrics
Do NOT repeat or paraphrase any query in the existing list.
Return only valid JSON — no markdown, no explanation.`;

  const userPrompt = `Ticker: ${ticker.symbol} (${ticker.name})
Top entities: ${entitySummary || "none"}
Recent themes: ${themeSummary || "none"}
Already generated queries (do not repeat):
${existingList || "(none)"}

Generate ${targetCount} additional diverse search queries as a JSON array.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      logger.warn({ tickerId: ticker.symbol }, "LLM returned empty content");
      return [];
    }

    // The model wraps the array in an object; try to extract it
    const parsed: unknown = JSON.parse(raw);
    const array: unknown =
      Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" && parsed !== null
          ? Object.values(parsed as Record<string, unknown>).find(Array.isArray)
          : undefined;

    if (!Array.isArray(array)) {
      logger.warn({ raw }, "LLM response did not contain a JSON array");
      return [];
    }

    const validated = llmResponseSchema.safeParse(array);
    if (!validated.success) {
      logger.warn({ errors: validated.error.issues }, "LLM response failed schema validation");
      return [];
    }

    return validated.data;
  } catch (err) {
    logger.warn({ err, symbol: ticker.symbol }, "LLM query generation failed; using deterministic-only set");
    return [];
  }
}
