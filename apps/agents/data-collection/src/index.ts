import { verifyAPIKey } from "@workspace/agent-utils";
import { env } from "@workspace/env/agents-data-collection";
import { prisma } from "@workspace/prisma";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";

const app = new Hono();

app.use("*", bearerAuth({ verifyToken: async (token) => verifyAPIKey(token) }));

const BodySchema = z.object({
  tickerId: z.string(),
  timeWindow: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
});

type BodySchemaType = z.infer<typeof BodySchema>;

interface WebPage {
  url: string;
  title: string;
  content: string;
  tickerId: string;
  searchQueryId: string;
}

app.post("/", async (context) => {
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);

    if (!env.JINA_API_KEY) {
      return context.json({ message: "JINA_API_KEY is not configured" }, 500);
    }

    const queries = await retrieveQueriesFromDatabase(data);
    const searchResults = await performWebSearchWithQueries(queries);
    const pages = await fetchWebPageContents(searchResults);

    const token = context.req.header("Authorization");

    if (pages.length > 0) {
      await sendToAgentDataAPI(token, pages);
    }

    return context.json(
      { agentId: "data-collection", agentVersion: "1.0.0" },
      200,
    );
  } catch (error) {
    return context.json({ message: "Internal Server Error" }, 500);
  }
});

async function retrieveQueriesFromDatabase(body: BodySchemaType) {
  return prisma.searchQuery.findMany({
    where: {
      tickerId: body.tickerId,
      ...(body.timeWindow && {
        createdAt: {
          gte: new Date(body.timeWindow.start),
          lte: new Date(body.timeWindow.end),
        },
      }),
    },
  });
}

async function performWebSearchWithQueries(
  queries: { id: string; text: string; tickerId: string }[],
) {
  // TODO: Implement actual web search
  return queries.map((query) => ({
    url: "https://www.example.com",
    title: "Example Domain",
    tickerId: query.tickerId,
    searchQueryId: query.id,
  }));
}

async function fetchWebPageContents(
  searchResults: Omit<WebPage, "content">[],
): Promise<WebPage[]> {
  const fetchPages = searchResults.map(async (result) => {
    const response = await fetch("https://r.jina.ai/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.JINA_API_KEY}`,
      },
      body: JSON.stringify({ url: result.url }),
    });

    if (!response.ok) {
      throw new Error(
        `Jina reader failed for URL "${result.url}": ${response.status}`,
      );
    }

    const json = await response.json();

    return {
      url: json.data?.url ?? result.url,
      title: json.data?.title ?? result.title,
      content: json.data?.content ?? "",
      tickerId: result.tickerId,
      searchQueryId: result.searchQueryId,
    };
  });

  return Promise.all(fetchPages);
}

async function sendToAgentDataAPI(token: string | undefined, pages: WebPage[]) {
  if (!env.AGENT_DATA_API_URL) {
    throw new Error("AGENT_DATA_API_URL is not defined");
  }

  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/data-collection";

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: token }),
    },
    body: JSON.stringify(pages),
  });
}

export default {
  port: 4000,
  fetch: app.fetch,
};
