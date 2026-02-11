import { verifyAPIKey } from "@workspace/agent-utils";
import { env } from "@workspace/env/agents-delivery";
import { prisma } from "@workspace/prisma";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { Resend } from "resend";
import { z } from "zod";

const app = new Hono();
const resend = new Resend(env.RESEND_API_KEY);

app.use("*", bearerAuth({ verifyToken: async (token) => verifyAPIKey(token) }));

const BodySchema = z.object({});

app.post("/", async (context) => {
  try {
    const body = await context.req.json();
    await BodySchema.parseAsync(body);

    const token = context.req.header("Authorization");

    await sendEmailToUsers();
    await sendToAgentDataAPI(token);

    return context.json({ agentId: "delivery", agentVersion: "1.0.0" }, 200);
  } catch (error) {
    return context.json({ message: "Internal Server Error" }, 500);
  }
});

async function sendEmailToUsers() {
  const users = await prisma.user.findMany();

  await Promise.all(
    users.map((user) =>
      resend.emails.send({
        from: env.RESEND_SENDER,
        to: user.email,
        subject: "Hello, World!",
        text: "What hath God wrought",
      }),
    ),
  );
}

async function sendToAgentDataAPI(token: string | undefined) {
  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/delivery";

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: token }),
    },
    body: JSON.stringify({
      userTickerId: "user_ticker_id_test",
    }),
  });
}

export default {
  port: 4000,
  fetch: app.fetch,
};
