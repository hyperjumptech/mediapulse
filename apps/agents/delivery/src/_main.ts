import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import { env } from "@workspace/env/agents-delivery";
import { logger } from "@workspace/logger";
import got from "got";
import { ZodError } from "zod";

import { deliveryInputSchema } from "@workspace/agent-types";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";

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

app.post("/", async (context) => {
  try {
    const body = await context.req.json();
    const data = await deliveryInputSchema.parseAsync(body);

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
    if (error instanceof ZodError) {
      return context.json(
        { message: "Bad Request", errors: error.errors },
        400,
      );
    }
    if (error instanceof SyntaxError) {
      return context.json({ message: "Malformed JSON" }, 400);
    }
    logger.error({ err: error }, "Delivery agent error");
    return context.json({ message: "Internal Server Error" }, 500);
  }
});

/**
 * Fetches the delivery data (newsletter and subscribers) for a specific ticker from the Agent Data API.
 *
 * @param token - The authorization token to pass to the API.
 * @param tickerId - The unique identifier of the ticker.
 * @returns A promise that resolves to the delivery data containing the newsletter and subscribers, or null.
 */
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
