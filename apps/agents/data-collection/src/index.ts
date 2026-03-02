import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import { env } from "@workspace/env/agents-data-collection";
import { logger } from "@workspace/logger";
import got from "got";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import { z } from "zod";

const app = new Hono();
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
  const logger = context.get("logger");
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);

    if (!env.JINA_API_KEY) {
      return context.json({ message: "JINA_API_KEY is not configured" }, 500);
    }

    if (!env.SERPER_API_KEY) {
      return context.json({ message: "SERPER_API_KEY is not configured" }, 500);
    }

    const queries = await fetchSearchQueriesFromAgentDataAPI(
      context.req.header("Authorization"),
      data,
    );
    const searchResults = await performWebSearchWithQueries(queries);
    const pages = await fetchWebPageContents(searchResults);

    const token = context.req.header("Authorization");

    if (pages.length > 0) {
      await sendToAgentDataAPI(token, data.tickerId, pages);
    }

    return context.json(
      { agentId: "data-collection", agentVersion: "1.0.0" },
      200,
    );
  } catch (error) {
    logger.error({ err: error }, "Data collection agent error");
    return context.json({ message: "Internal Server Error" }, 500);
  }
});

async function fetchSearchQueriesFromAgentDataAPI(
  token: string | undefined,
  body: BodySchemaType,
) {
  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/api/data-collection";
  url.searchParams.set("tickerId", body.tickerId);
  if (body.timeWindow) {
    url.searchParams.set("start", body.timeWindow.start);
    url.searchParams.set("end", body.timeWindow.end);
  }

  const res = await got.get(url.toString(), {
    headers: { ...(token && { Authorization: token }) },
  });
  const data = JSON.parse(res.body) as { searchQueries: SearchQuery[] };
  return data.searchQueries;
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
        .json<{
          organic?: Array<{ link?: string; title?: string; snippet?: string }>;
        }>();
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

async function sendToAgentDataAPI(
  token: string | undefined,
  tickerId: string,
  pages: WebPage[],
) {
  if (!env.AGENT_DATA_API_URL) {
    throw new Error("AGENT_DATA_API_URL is not defined");
  }

  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/api/data-collection";

  await got.post(url.toString(), {
    json: pages.map((page) => ({
      url: page.url,
      title: page.title,
      content: page.content,
      tickerId,
      searchQueryId: page.searchQueryId,
    })),
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
