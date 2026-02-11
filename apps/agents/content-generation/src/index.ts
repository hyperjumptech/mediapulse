import { verifyAPIKey } from "@workspace/agent-utils";
import { env } from "@workspace/env/agents-content-generation";
import { prisma } from "@workspace/prisma";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import OpenAI from "openai";
import { z } from "zod";

const app = new Hono();
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

app.use("*", bearerAuth({ verifyToken: async (token) => verifyAPIKey(token) }));

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
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);

    const dataSources = await retrieveDataSources(data.tickerId);

    if (dataSources.length === 0) {
      return context.json(
        { message: "No data sources found for this ticker" },
        404,
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
    return context.json({ message: "Internal Server Error" }, 500);
  }
});

async function retrieveDataSources(
  tickerId: string,
): Promise<DataSourceRecord[]> {
  return prisma.dataSource.findMany({
    where: { tickerId },
  });
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
  url.pathname = "/content-generation";

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: token }),
    },
    body: JSON.stringify({
      subject: generated.subject,
      content: generated.content,
      tickerId,
    }),
  });
}

export default {
  port: 4000,
  fetch: app.fetch,
};
