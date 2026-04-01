import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";
import OpenAI from "openai";
import { z } from "zod";

import type { QueryCandidate } from "./deterministic-baseline.js";

const llmRowSchema = z.object({
  text: z.string().min(1),
  intent: z.enum(["breaking", "kg_change", "fundamental"]),
});

const llmResponseSchema = z.object({
  queries: z.array(llmRowSchema),
});

/**
 * Expands search queries via OpenAI and returns validated query candidates.
 */
export const expandQueriesWithLlm = async (
  ctx: GetQueryAnalysisResponse,
  deps: {
    openaiApiKey: string;
    model: string;
    maxTokens: number;
    extraCount: number;
  },
): Promise<QueryCandidate[]> => {
  const openai = new OpenAI({ apiKey: deps.openaiApiKey });
  const prompt = [
    `Generate up to ${deps.extraCount} concise web search queries for stock ticker ${ctx.ticker.symbol} (${ctx.ticker.name}).`,
    "Prioritize: (1) breaking news, (2) relationship and corporate-action changes, (3) fundamentals.",
    'Respond with JSON only: {"queries":[{"text":"...","intent":"breaking|kg_change|fundamental"},...]}',
    `Allowed languages for query text: ${ctx.configSnapshot.allowedLanguages.join(", ")}.`,
  ].join("\n");

  const response = await openai.chat.completions.create({
    model: deps.model,
    max_tokens: deps.maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const decoded = llmResponseSchema.safeParse(parsed);
  if (!decoded.success) {
    return [];
  }

  return decoded.data.queries.map((row, index) => ({
    text: row.text.trim(),
    source: "llm" as const,
    intent: row.intent,
    rank: index,
  }));
};
