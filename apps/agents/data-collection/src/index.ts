import { verifyAPIKey } from "@workspace/agent-utils";
import { env } from "@workspace/env";
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

app.post("/", async (context) => {
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);
    const queries = await retrieveQueriesFromDatabase(data);
    console.log("queries", queries);

    await performWebSearchWithQueries();
    await fetchWebPageContentsFromResults();
    const token = context.req.header("Authorization");

    for (const query of queries) {
      await sendToAgentDataAPI(token, data.tickerId, query.id);
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

async function performWebSearchWithQueries() {
  // TODO: Implement search queries logic
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

async function fetchWebPageContentsFromResults() {
  // TODO: Implement web content fetching logic
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

async function sendToAgentDataAPI(
  token: string | undefined,
  tickerId: string,
  searchQueryId: string,
) {
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
    body: JSON.stringify([
      {
        url: "https://apple.com",
        title: "Apple",
        content: "Apple Inc. is an American multinational technology company.",
        tickerId,
        searchQueryId,
      },
    ]),
  });
}

export default {
  port: 4000,
  fetch: app.fetch,
};
