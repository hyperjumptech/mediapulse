import { createOpenAI } from "@ai-sdk/openai";

import {
  generateNewsletterWithLlm,
  groupSourcesBySection,
  type GenerateNewsletterObjectFn,
  type SourceForGeneration,
} from "../../src/llm-generate-newsletter.js";
import { articleSummarySchema } from "../../src/summarize-article.js";
import { resolveContentGenerationConfig } from "../../src/config-schema.js";
import type { EvalCase, PoolArticle, SummarizerCall } from "./types.js";
import {
  referenceRateBlock,
  reportingPeriodEnd,
  usdIdrRate,
} from "./reference-rate.js";
import type { PromptVariant } from "./variants.js";

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

const toSourceForGeneration = (article: PoolArticle): SourceForGeneration => ({
  dataSourceId: article.dataSourceId,
  url: article.url,
  title: article.title,
  content: article.content,
  ...(article.author === null ? {} : { author: article.author }),
  ...(article.source === null ? {} : { source: article.source }),
  ...(article.publishedAt === null ? {} : { publishedAt: article.publishedAt }),
  ...(article.section === null ? {} : { section: article.section }),
  ...(article.sectionScore === null
    ? {}
    : { sectionScore: article.sectionScore }),
  ...(article.publisherAuthority === null
    ? {}
    : { publisherAuthority: article.publisherAuthority }),
  contentIsDescriptionOnly: article.contentIsDescriptionOnly,
});

const titleFromPrompt = (prompt: string): string =>
  (prompt.split("\n")[0] ?? "").replace(/^Title:\s*/, "").trim();

export type ReplayOutcome = {
  caseId: string;
  model: string;
  promptVariant: string;
  repeat: number;
  status: "generated" | "failed";
  failureReason?: string;
  subject?: string;
  document?: unknown;
  summarizerCalls: SummarizerCall[];
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
};

export const replayCase = async (
  evalCase: EvalCase,
  model: string,
  variant: PromptVariant,
  repeat: number,
): Promise<ReplayOutcome> => {
  const startedAt = Date.now();
  const summarizerCalls: SummarizerCall[] = [];

  let rateBlock = "";
  if (variant.suppliesReferenceRate) {
    const periodEnd = reportingPeriodEnd(new Date(evalCase.run_at));
    const rate = await usdIdrRate(periodEnd);
    rateBlock = rate === null ? "" : referenceRateBlock(rate, periodEnd);
  }

  const generateObjectFn: GenerateNewsletterObjectFn = async (args) => {
    const isSummarizer = args.schema === articleSummarySchema;
    const system = isSummarizer ? variant.summarizerSystemPrompt : args.system;
    const prompt = isSummarizer ? `${args.prompt}${rateBlock}` : args.prompt;
    const { generateObject } = await import("ai");
    const result = await generateObject({
      ...args,
      model: openrouter(model),
      system,
      prompt,
    });
    if (isSummarizer) {
      summarizerCalls.push({
        articleTitle: titleFromPrompt(args.prompt),
        prompt,
        rawSummary: result.object as SummarizerCall["rawSummary"],
      });
    }

    return {
      object: result.object,
      usage: {
        promptTokens: result.usage?.inputTokens,
        completionTokens: result.usage?.outputTokens,
      },
    };
  };

  const config = resolveContentGenerationConfig({
    model: { apiKey: process.env.OPENROUTER_API_KEY ?? "", model, baseUrl: "" },
  });
  const sources = groupSourcesBySection(
    evalCase.pool.map(toSourceForGeneration),
  );

  try {
    const generated = await generateNewsletterWithLlm(
      sources,
      config,
      {
        tickerId: evalCase.case_id,
        date: evalCase.run_at.slice(0, 10),
        tickerSymbol: evalCase.symbol,
        issuerAliases: evalCase.aliases,
        ...(evalCase.ticker_name === null
          ? {}
          : { tickerName: evalCase.ticker_name }),
        ...(evalCase.brief === null ? {} : { brief: evalCase.brief }),
        competitors: (evalCase.competitors ?? []).map((competitor) => ({
          name: competitor.name,
          relation: "competitor",
        })),
        recentBullets: evalCase.recent_bullets ?? [],
      },
      { generateObjectFn },
    );

    return {
      caseId: evalCase.case_id,
      model,
      promptVariant: variant.id,
      repeat,
      status: "generated",
      subject: generated.subject,
      document: JSON.parse(generated.content),
      summarizerCalls,
      promptTokens: generated.promptTokens,
      completionTokens: generated.completionTokens,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      caseId: evalCase.case_id,
      model,
      promptVariant: variant.id,
      repeat,
      status: "failed",
      failureReason: error instanceof Error ? error.message : String(error),
      summarizerCalls,
      promptTokens: null,
      completionTokens: null,
      durationMs: Date.now() - startedAt,
    };
  }
};
