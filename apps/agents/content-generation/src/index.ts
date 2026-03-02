import type { DataSourceRecord } from "@workspace/agent-types";
import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import { env } from "@workspace/env/agents-content-generation";
import { logger } from "@workspace/logger";
import got from "got";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import OpenAI from "openai";
import { z } from "zod";

import { formatNewsletterContent } from "./format-newsletter-content.js";

const app = new Hono();
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

app.use(pinoLogger({ pino: logger }));

app.use(
  "*",
  bearerAuth({
    verifyToken: (token) =>
      verifyTokenViaAuthApi(token, env.AGENT_AUTH_API_URL),
  }),
);

const BodySchema = z.object({
  tickerId: z.string(),
});

interface GeneratedContent {
  subject: string;
  content: string;
  /** Optional executive summary, e.g. for newsletter preview or listing. */
  description?: string;
}

interface NewsletterStructure {
  subject: string;
  executiveSummary: string;
  topNews: Array<{ title: string; summary: string }>;
}

app.post("/", async (context) => {
  const logger = context.get("logger");
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);

    const sources = await fetchSourcesFromAgentDataAPI(
      context.req.header("Authorization"),
      data.tickerId,
    );

    if (sources.length === 0) {
      logger.info(
        { tickerId: data.tickerId },
        "No sources found for this ticker, skipping content generation",
      );

      return context.json(
        {
          agentId: "content-generation",
          agentVersion: "1.0.0",
          skipped: true,
          message: "No data sources found for this ticker",
        },
        200,
      );
    }

    const generated = await generateContentWithOpenAI(sources);

    const token = context.req.header("Authorization");
    await sendToAgentDataAPI(token, data.tickerId, generated);

    return context.json(
      { agentId: "content-generation", agentVersion: "1.0.0" },
      200,
    );
  } catch (error) {
    logger.error({ err: error }, "Content generation agent error");
    return context.json({ message: "Internal Server Error" }, 500);
  }
});

async function fetchSourcesFromAgentDataAPI(
  token: string | undefined,
  tickerId: string,
): Promise<DataSourceRecord[]> {
  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/api/content-generation";
  url.searchParams.set("tickerId", tickerId);

  const res = await got.get(url.toString(), {
    headers: { ...(token && { Authorization: token }) },
  });
  const body = JSON.parse(res.body) as { dataSources: DataSourceRecord[] };
  return body.dataSources;
}

/**
 * Calls OpenAI to generate a newsletter with an executive summary and top 3 news items.
 *
 * @param sources - Fetched articles/sources to summarize.
 * @returns Subject and formatted plain-text content for the newsletter.
 */
async function generateContentWithOpenAI(
  sources: DataSourceRecord[],
): Promise<GeneratedContent> {
  const sourceSummaries = sources
    .map(
      (source) => `Source: ${source.title} (${source.url})\n${source.content}`,
    )
    .join("\n\n---\n\n");

  const response = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
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

  const parsed = JSON.parse(result) as NewsletterStructure;
  const topNews = Array.isArray(parsed.topNews)
    ? parsed.topNews.slice(0, 3)
    : [];
  const content = formatNewsletterContent(
    parsed.executiveSummary ?? "",
    topNews,
  );

  return {
    subject: parsed.subject ?? "Your daily briefing",
    content,
    description: parsed.executiveSummary?.trim() || undefined,
  };
}

async function sendToAgentDataAPI(
  token: string | undefined,
  tickerId: string,
  generated: GeneratedContent,
) {
  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/api/content-generation";

  const res = await got.post(url.toString(), {
    json: {
      subject: generated.subject,
      content: generated.content,
      ...(generated.description && { description: generated.description }),
      tickerId,
    },
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: token }),
    },
    throwHttpErrors: false,
  });

  if (!res.ok) {
    logger.error(
      {
        tickerId,
        statusCode: res.statusCode,
        body: res.body,
      },
      "Agent data API rejected newsletter store",
    );
    throw new Error(`Agent data API returned ${res.statusCode}: ${res.body}`);
  }

  logger.info({ tickerId }, "Stored newsletter for ticker");
}

export default {
  port: env.PORT ?? 4002,
  fetch: app.fetch,
};
