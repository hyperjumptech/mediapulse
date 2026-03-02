import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import { env } from "@workspace/env/agents-content-generation";
import { logger } from "@workspace/logger";
import got from "got";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import OpenAI from "openai";
import { z } from "zod";

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

interface DataSourceRecord {
  id: string;
  url: string;
  title: string;
  content: string;
  metadata: unknown;
  tickerId: string;
  searchQueryId: string;
}

interface GeneratedContent {
  subject: string;
  content: string;
}

app.post("/", async (context) => {
  const logger = context.get("logger");
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);

    const dataSources = await fetchDataSourcesFromAgentDataAPI(
      context.req.header("Authorization"),
      data.tickerId,
    );

    if (dataSources.length === 0) {
      logger.info(
        { tickerId: data.tickerId },
        "No data sources found for this ticker, skipping content generation",
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

    const generated = await generateContentWithOpenAI(dataSources);

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

async function fetchDataSourcesFromAgentDataAPI(
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

async function generateContentWithOpenAI(
  dataSources: DataSourceRecord[],
): Promise<GeneratedContent> {
  const sourceSummaries = dataSources
    .map(
      (source) => `Source: ${source.title} (${source.url})\n${source.content}`,
    )
    .join("\n\n---\n\n");

  const response = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a newsletter writer. Given multiple data sources, summarize the content into a concise and informative newsletter. Return a JSON object with two fields: 'subject' (a compelling email subject line) and 'content' (the summarized newsletter body in plain text).",
      },
      {
        role: "user",
        content: `Summarize the following data sources into a newsletter:\n\n${sourceSummaries}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const result = response.choices[0]?.message?.content;

  if (!result) {
    throw new Error("OpenAI returned an empty response");
  }

  const parsed = JSON.parse(result) as GeneratedContent;

  return {
    subject: parsed.subject,
    content: parsed.content,
  };
}

async function sendToAgentDataAPI(
  token: string | undefined,
  tickerId: string,
  generated: GeneratedContent,
) {
  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/api/content-generation";

  await got.post(url.toString(), {
    json: {
      subject: generated.subject,
      content: generated.content,
      tickerId,
    },
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: token }),
    },
  });
}

export default {
  port: 4000,
  fetch: app.fetch,
};
