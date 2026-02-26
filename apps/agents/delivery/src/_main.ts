import { verifyAPIKey } from "@workspace/agent-utils";
import { env } from "@workspace/env/agents-delivery";
import { logger } from "@workspace/logger";
import got from "got";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import { z } from "zod";

import { sendEmailToUsers } from "./send-email-to-users.js";
import { sendToAgentDataAPI } from "./send-to-agent-data-api.js";

const app = new Hono();

app.use(pinoLogger({ pino: logger }));
app.use("*", bearerAuth({ verifyToken: async (token) => verifyAPIKey(token) }));

const BodySchema = z.object({
  tickerId: z.string().uuid(),
});

app.post("/", async (context) => {
  const logger = context.get("logger");
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);

    const token = context.req.header("Authorization");

    const { newsletter, subscribers } = await fetchDeliveryDataFromAgentDataAPI(
      token,
      data.tickerId,
    );

    if (subscribers.length > 0) {
      await sendEmailToUsers(newsletter, subscribers);
    }

    await sendToAgentDataAPI(token, data.tickerId);

    return context.json({ agentId: "delivery", agentVersion: "1.0.0" }, 200);
  } catch (error) {
    logger.error({ err: error }, "Delivery agent error");
    return context.json({ message: "Internal Server Error" }, 500);
  }
});

async function fetchDeliveryDataFromAgentDataAPI(
  token: string | undefined,
  tickerId: string,
) {
  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/api/delivery";
  url.searchParams.set("tickerId", tickerId);

  const res = await got.get(url.toString(), {
    headers: { ...(token && { Authorization: token }) },
    throwHttpErrors: false,
  });

  if (res.statusCode === 404) {
    throw new Error("No newsletter found for this ticker");
  }

  if (!res.ok) {
    throw new Error(`Agent data API error: ${res.statusCode}`);
  }

  const body = JSON.parse(res.body) as {
    newsletter: { subject: string; content: string };
    subscribers: { email: string }[];
  };
  return body;
}

export default {
  port: 4000,
  fetch: app.fetch,
};
