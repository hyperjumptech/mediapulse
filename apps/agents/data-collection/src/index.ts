import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";

import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import { AgentDataApiClient } from "@workspace/agent-data-api-client";
import { env } from "@workspace/env/agents-data-collection";
import { logger } from "@workspace/logger";

import { BodySchema } from "./utilities/body-schema.js";
import { getConfigSchema } from "./utilities/config-schema.js";
import { performWebSearch } from "./utilities/web-search.js";
import { performWebFetch } from "./utilities/web-fetch.js";

const app = new Hono();

app.use(pinoLogger({ pino: logger }));

app.use(
  "*",
  bearerAuth({
    verifyToken: (token) => {
      return verifyTokenViaAuthApi(token, env.AGENT_AUTH_API_URL);
    },
  }),
);

const agentDataApiClient = new AgentDataApiClient({
  url: `${env.AGENT_DATA_API_URL}/api/data-collection`,
});

app.post("/", async (context) => {
  if (!env.JINA_API_KEY) {
    return context.json({ message: "JINA_API_KEY is not configured" }, 500);
  }

  if (!env.SERPER_API_KEY) {
    return context.json({ message: "SERPER_API_KEY is not configured" }, 500);
  }

  try {
    const apiKey = context.req.header("Authorization");
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);

    const query: Record<string, string> = {
      tickerId: data.tickerId,
    };

    if (data.timeWindow) {
      query.start = data.timeWindow.start;
      query.end = data.timeWindow.end;
    }

    const { data: queries } = await agentDataApiClient.get<{
      data: { text: string }[];
    }>({ query, apiKey });

    const queryTexts = queries.map((query) => query.text);

    const searchResults = await performWebSearch(queryTexts, {
      serperApiKey: env.SERPER_API_KEY,
    });

    const fetchResults = await performWebFetch(searchResults, {
      jinaApiKey: env.JINA_API_KEY,
    });

    if (fetchResults.length > 0) {
      await agentDataApiClient.post({
        body: fetchResults.map((page) => ({
          url: page.url,
          title: page.title,
          description: page.description,
          tickerId: data.tickerId,
        })),
        apiKey,
      });
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

app.get("/config", (context) => context.json(getConfigSchema(), 200));

export default {
  port: env.PORT ?? 4001,
  fetch: app.fetch,
};
