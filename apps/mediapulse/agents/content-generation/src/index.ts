import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp, hermesTickerIdSchema } from "@workspace/agent-runtime";
/** Agent T3 env: import the typed `@mediapulse/env/agents-content-generation` module (not the root `@mediapulse/env` app bundle). */
import { env } from "@mediapulse/env/agents-content-generation";
import { logger } from "@workspace/logger";
import OpenAI from "openai";
import pRetry from "p-retry";
import { z } from "zod";

import {
  ContentGenerationConfigSchema,
  type ContentGenerationConfig,
} from "./config-schema.js";
import { formatNewsletterContent } from "./format-newsletter-content.js";
import { parseNewsletterJson } from "./parse-newsletter-json.js";

const BodySchema = z.object({
  tickerId: hermesTickerIdSchema,
});

type Input = z.infer<typeof BodySchema>;

type SourceForGeneration = {
  url: string;
  title: string;
  content: string;
};

interface GeneratedContent {
  subject: string;
  content: string;
  /** Optional executive summary, e.g. for newsletter preview or listing. */
  description?: string;
}

const app = createAgentApp<
  Input,
  typeof BodySchema,
  ContentGenerationConfig,
  typeof ContentGenerationConfigSchema
>(
  {
    agentId: "content-generation",
    agentVersion: "1.0.0",
    inputSchema: BodySchema,
    configSchema: ContentGenerationConfigSchema,
    run: async ({ input, config, token }) => {
      const dataApiClient = createAgentDataApiClient({
        baseUrl: env.AGENT_DATA_API_URL,
        version: "v1",
        token,
      });
      const { dataSources: sources } =
        await dataApiClient.contentGeneration.get({
          tickerId: input.tickerId,
        });

      logger.info({ sources }, "Data sources for ticker");
      logger.info({ config }, "Config");

      if (!sources?.length) {
        return {
          success: false,
          message: "No data sources found for this ticker",
        };
      }

      const preparedSources = prepareContext(sources, config);
      const openai = new OpenAI({
        apiKey: config.openai?.apiKey ?? config.openaiApiKey,
        baseURL: config.openai?.baseUrl ?? config.openaiBaseUrl,
        timeout: config.openai?.timeoutMs,
      });
      const model = config.openai?.model ?? config.openaiModel ?? "gpt-4o-mini";
      const temperature = config.openai?.temperature ?? 0.4;

      const generated = await pRetry(
        () =>
          generateContentWithOpenAI(preparedSources, {
            openai,
            model,
            temperature,
            config,
            tickerId: input.tickerId,
          }),
        {
          retries: config.llmRetry?.maxAttempts ?? 3,
          minTimeout: config.llmRetry?.baseDelayMs ?? 500,
          maxTimeout: config.llmRetry?.maxDelayMs ?? 8000,
          onFailedAttempt: (error) => {
            logger.warn(
              { error, attempt: error.attemptNumber },
              "LLM generation failed, retrying...",
            );
          },
        },
      );
      try {
        await pRetry(
          () =>
            dataApiClient.contentGeneration.create({
              subject: generated.subject,
              content: generated.content,
              ...(generated.description && {
                description: generated.description,
              }),
              tickerId: input.tickerId,
            }),
          {
            retries: config.persistRetry?.maxAttempts ?? 2,
            minTimeout: config.persistRetry?.baseDelayMs ?? 200,
            maxTimeout: config.persistRetry?.maxDelayMs ?? 2000,
          },
        );
      } catch (err) {
        logger.error(
          { tickerId: input.tickerId, err },
          "Agent data API rejected newsletter store",
        );
        throw err;
      }

      logger.info({ tickerId: input.tickerId }, "Stored newsletter for ticker");
      return { success: true };
    },
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
    autoRegister:
      env.AGENT_REGISTRY_URL &&
      env.DOMAIN_INTEGRATION_API_KEY &&
      env.AGENT_PUBLIC_URL
        ? {
            registryUrl: env.AGENT_REGISTRY_URL,
            domainIntegrationId: env.DOMAIN_INTEGRATION_ID,
            domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

/**
 * Truncates and limits sources based on agent configuration.
 * Ensures we stay within context limits for the LLM.
 */
function prepareContext(
  sources: SourceForGeneration[],
  config: ContentGenerationConfig,
): SourceForGeneration[] {
  const maxPerSource = config.context?.maxCharsPerSource ?? 8000;
  const maxTotal = config.context?.maxTotalContextChars ?? 100000;

  let currentTotal = 0;
  const prepared: SourceForGeneration[] = [];

  for (const source of sources) {
    const truncatedContent = source.content.slice(0, maxPerSource);
    const sourceSize = source.title.length + truncatedContent.length;

    if (currentTotal + sourceSize > maxTotal) {
      // If adding this source exceeds the total, we take what we can if we haven't reached the limit
      const remainingBytes = maxTotal - currentTotal;
      if (remainingBytes > 100) {
        prepared.push({
          ...source,
          content: truncatedContent.slice(0, Math.max(0, remainingBytes - source.title.length)),
        });
      }
      break;
    }

    prepared.push({
      ...source,
      content: truncatedContent,
    });
    currentTotal += sourceSize;
  }

  return prepared;
}

/**
 * Calls OpenAI to generate a newsletter with an executive summary and top news items.
 *
 * @param sources - Fetched articles/sources to summarize.
 * @param deps - OpenAI client, model, and configuration for rendering prompts.
 * @returns Subject and formatted plain-text content for the newsletter.
 */
async function generateContentWithOpenAI(
  sources: SourceForGeneration[],
  deps: {
    openai: OpenAI;
    model: string;
    temperature: number;
    config: ContentGenerationConfig;
    tickerId: string;
  },
): Promise<GeneratedContent> {
  const sourceSummaries = sources
    .map(
      (source) => `Source: ${source.title} (${source.url})\n${source.content}`,
    )
    .join("\n\n---\n\n");

  const today = new Date().toISOString().split("T")[0];
  const defaultSystemPrompt = `You are a newsletter writer for busy executives. Given multiple data sources, produce a structured newsletter.

Return a JSON object with:
- "subject": a compelling email subject line (short, under ~60 chars).
- "executiveSummary": 2–3 sentences summarizing the main themes and why they matter. No bullet points; use clear prose.
- "topNews": an array of news items. Each item has "title" (short headline) and "summary" (2–4 sentences). Pick the most important or impactful stories. Keep summaries concise and actionable.`;

  const defaultUserPrompt = `Create a newsletter from these data sources. Include an executive summary and the top items with brief summaries.\n\n{{sourceSummaries}}`;

  const systemContent = deps.config.prompts?.systemPrompt || defaultSystemPrompt;
  const userTemplate =
    deps.config.prompts?.userPromptTemplate || defaultUserPrompt;

  const userContent = userTemplate
    .replace("{{sourceSummaries}}", sourceSummaries)
    .replace("{{tickerId}}", deps.tickerId)
    .replace("{{date}}", today ?? "");

  const response = await deps.openai.chat.completions.create({
    model: deps.model,
    temperature: deps.temperature,
    messages: [
      {
        role: "system",
        content: systemContent,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    response_format: { type: "json_object" },
  });

  const result = response.choices[0]?.message?.content;

  if (!result) {
    throw new Error("OpenAI returned an empty response");
  }

  const validated = parseNewsletterJson(result);
  const topNewsCount = deps.config.output?.topNewsCount ?? 3;
  const topNews = Array.isArray(validated.topNews)
    ? validated.topNews.slice(0, topNewsCount)
    : [];
  const content = formatNewsletterContent(
    validated.executiveSummary ?? "",
    topNews,
  );

  return {
    subject: validated.subject ?? "Your daily briefing",
    content,
    description: validated.executiveSummary?.trim() || undefined,
  };
}

export default {
  port: env.PORT ?? 4002,
  fetch: app.fetch,
};
