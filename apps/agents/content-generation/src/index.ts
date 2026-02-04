import { verifyAPIKey } from "@workspace/agent-utils";
import { env } from "@workspace/env";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";

const app = new Hono();

app.use("*", bearerAuth({ verifyToken: async (token) => verifyAPIKey(token) }));

const BodySchema = z.object({
  tickerId: z.string(),
});

app.post("/", async (context) => {
  try {
    const body = await context.req.json();
    await BodySchema.parseAsync(body);

    await retrieveAnalysisResultsFromDatabase();
    await generateContentsFromAnalysisResults();
    await formatGeneratedContents();

    const token = context.req.header("Authorization");
    await sendToAgentDataAPI(token, body.tickerId);

    return context.json(
      { agentId: "content-generation", agentVersion: "1.0.0" },
      200,
    );
  } catch (error) {
    return context.json({ message: "Internal Server Error" }, 500);
  }
});

async function retrieveAnalysisResultsFromDatabase() {
  // TODO: Implement search queries logic
  console.log("Retrieving analysis results from database...");
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log("Analysis results retrieved successfully");
}

async function generateContentsFromAnalysisResults() {
  // TODO: Implement search queries logic
  console.log("Generating contents from analysis results...");
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log("Contents generated successfully");
}

async function formatGeneratedContents() {
  // TODO: Implement web content fetching logic
  console.log("Formatting generated contents...");
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log("Formatted contents successfully");
}

async function sendToAgentDataAPI(token: string | undefined, tickerId: string) {
  if (!env.AGENT_DATA_API_URL) {
    throw new Error("AGENT_DATA_API_URL is not defined");
  }

  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/content-generation";

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: token }),
    },
    body: JSON.stringify({
      subject: "Apple - Subject",
      content: "Apple Inc. is an American multinational technology company.",
      tickerId,
    }),
  });
}

export default {
  port: 4000,
  fetch: app.fetch,
};
