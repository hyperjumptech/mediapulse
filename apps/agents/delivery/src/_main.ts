import { verifyAPIKey } from "@workspace/agent-utils";
import { logger } from "@workspace/logger";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import { z } from "zod";

import { prisma } from "@workspace/database";

import { getNewsletter } from "./get-newsletter.js";
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

    const newsletter = await getNewsletter(data.tickerId);

    const subscriptions = await prisma.userTicker.findMany({
      where: { tickerId: data.tickerId, enabled: true },
      include: { user: true },
    });

    if (subscriptions.length > 0) {
      const subscribers = subscriptions.map((s) => s.user);
      await sendEmailToUsers(newsletter, subscribers);
    }

    await sendToAgentDataAPI(token, data.tickerId);

    return context.json({ agentId: "delivery", agentVersion: "1.0.0" }, 200);
  } catch (error) {
    logger.error({ err: error }, "Delivery agent error");
    return context.json({ message: "Internal Server Error" }, 500);
  }
});

export default {
  port: 4000,
  fetch: app.fetch,
};
