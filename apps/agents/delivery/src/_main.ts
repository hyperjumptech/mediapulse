import { verifyAPIKey } from "@workspace/agent-utils";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";

import { getNewsletter } from "./get-newsletter.js";
import { sendEmailToUsers } from "./send-email-to-users.js";
import { sendToAgentDataAPI } from "./send-to-agent-data-api.js";

const app = new Hono();

app.use("*", bearerAuth({ verifyToken: async (token) => verifyAPIKey(token) }));

const BodySchema = z.object({
  tickerId: z.string().uuid(),
});

app.post("/", async (context) => {
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);

    const token = context.req.header("Authorization");

    const newsletter = await getNewsletter(data.tickerId);
    await sendEmailToUsers(newsletter);
    await sendToAgentDataAPI(token);

    return context.json({ agentId: "delivery", agentVersion: "1.0.0" }, 200);
  } catch (error) {
    return context.json({ message: "Internal Server Error" }, 500);
  }
});

export default {
  port: 4000,
  fetch: app.fetch,
};
