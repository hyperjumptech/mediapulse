import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp, hermesTickerIdSchema } from "@workspace/agent-runtime";
/** Agent T3 env: import the typed `@mediapulse/env/agents-content-generation` module (not the root `@mediapulse/env` app bundle). */
import { env } from "@mediapulse/env/agents-content-generation";
import { logger } from "@workspace/logger";
import OpenAI from "openai";
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

      const openai = new OpenAI({
        apiKey: config.openaiApiKey,
        ...(config.openaiBaseUrl ? { baseURL: config.openaiBaseUrl } : {}),
      });
      const model = config.openaiModel ?? "gpt-4o-mini";
      const generated = await generateContentWithOpenAI(sources, {
        openai,
        model,
      });
      try {
        await dataApiClient.contentGeneration.create({
          subject: generated.subject,
          content: generated.content,
          ...(generated.description && {
            description: generated.description,
          }),
          tickerId: input.tickerId,
        });
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
 * Calls OpenAI to generate a newsletter with an executive summary and top 3 news items.
 *
 * @param sources - Fetched articles/sources to summarize.
 * @param deps - OpenAI client and model from pipeline agent config.
 * @returns Subject and formatted plain-text content for the newsletter.
 */
async function generateContentWithOpenAI(
  sources: SourceForGeneration[],
  deps: { openai: OpenAI; model: string },
): Promise<GeneratedContent> {
  const sourceSummaries = sources
    .map(
      (source) => `Source: ${source.title} (${source.url})\n${source.content}`,
    )
    .join("\n\n---\n\n");

  const response = await deps.openai.chat.completions.create({
    model: deps.model,
    messages: [
      {
        role: "system",
        content: `You are a newsletter writer for busy executives. Given multiple data sources, produce a structured newsletter.

Return a JSON object with:
- "subject": a compelling email subject line (short, under ~60 chars).
- "executiveSummary": 2–3 sentences summarizing the main themes and why they matter. No bullet points; use clear prose.
- "topNews": an array of exactly 3 items. Each item has "title" (short headline) and "summary" (2–4 sentences). Pick the 3 most important or impactful stories. Keep summaries concise and actionable.`,
      },
      {
        role: "user",
        content: `Create a newsletter from these data sources. Include an executive summary and the top 3 news items with brief summaries.\n\n${sourceSummaries}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const result = response.choices[0]?.message?.content;

  if (!result) {
    throw new Error("OpenAI returned an empty response");
  }

  const validated = parseNewsletterJson(result);
  const topNews = Array.isArray(validated.topNews)
    ? validated.topNews.slice(0, 3)
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
