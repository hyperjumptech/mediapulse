import { verifyAPIKey } from "@workspace/agent-utils";
import { env } from "@workspace/env/agents-data-collection";
import { prisma } from "@workspace/database";
import got from "got";

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

    if (!env.SERPER_API_KEY) {
      return context.json({ message: "SERPER_API_KEY is not configured" }, 500);
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
    console.error("Data collection agent error:", error);
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
type SearchQuery = {
  id: string;
  text: string;
  tickerId: string;
};

export async function performWebSearchWithQueries(
  queries: SearchQuery[],
): Promise<WebPage[]> {
  if (!queries.length) return [];

  const results = await Promise.all(
    queries.map(async (query) => {
      const data = await got
        .post("https://google.serper.dev/search", {
          json: { q: query.text },
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": env.SERPER_API_KEY,
          },
        })
        .json<{ organic?: Array<{ link?: string; title?: string; snippet?: string }> }>();
      const first = data?.organic?.[0];

      return {
        url: first?.link ?? "",
        title: first?.title ?? "",
        content: first?.snippet ?? "",
        tickerId: query.tickerId,
        searchQueryId: query.id,
      };
    }),
  );

  return results;
}

async function fetchWebPageContents(
  searchResults: Omit<WebPage, "content">[],
): Promise<WebPage[]> {
  const fetchPages = searchResults.map(async (result) => {
    const json = await got
      .post("https://r.jina.ai/", {
        json: { url: result.url },
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.JINA_API_KEY}`,
        },
      })
      .json<{
        data?: { url?: string; title?: string; content?: string };
      }>();

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

  await got.post(url.toString(), {
    json: pages,
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
