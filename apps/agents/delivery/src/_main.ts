import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
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
app.use(
  "*",
  bearerAuth({
    verifyToken: (token) =>
      verifyTokenViaAuthApi(token, env.AGENT_AUTH_API_URL),
  }),
);

const BodySchema = z.object({
  tickerId: z.string().uuid(),
});

app.post("/", async (context) => {
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);

    const token = context.req.header("Authorization");

    const deliveryData = await fetchDeliveryDataFromAgentDataAPI(
      token,
      data.tickerId,
    );

    if (!deliveryData) {
      logger.info(
        { tickerId: data.tickerId },
        "No newsletter for this ticker, skipping delivery",
      );
      return context.json(
        { agentId: "delivery", agentVersion: "1.0.0", skipped: true },
        200,
      );
    }

    const { newsletter, subscribers } = deliveryData;

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
): Promise<{
  newsletter: { subject: string; content: string };
  subscribers: { email: string }[];
} | null> {
  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/api/delivery";
  url.searchParams.set("tickerId", tickerId);

  const res = await got.get(url.toString(), {
    headers: { ...(token && { Authorization: token }) },
    throwHttpErrors: false,
  });

  if (res.statusCode === 404) {
    return null;
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
  port: env.PORT ?? 4003,
  fetch: app.fetch,
};
