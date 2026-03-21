import { verifyApiKeyViaAuthApi } from "@workspace/agent-auth-client";
import { prisma } from "@workspace/orchestration-database";
import { env } from "@hermes/env";
import { logger } from "@workspace/logger";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import { registerAgent } from "./routes/register-agent";

if (!env.AGENT_AUTH_API_URL) {
  throw new Error("AGENT_AUTH_API_URL is required for agent-registry-api");
}

const app = new Hono();
const api = app.basePath("/api");

api.use(
  pinoLogger({
    pino: logger,
    http: {
      onResBindings: (c) => ({
        res: {
          status: c.res.status,
          headers: Object.fromEntries(c.res.headers.entries()),
        },
      }),
    },
  }),
);

api.use(
  "*",
  bearerAuth({
    verifyToken: (token) =>
      verifyApiKeyViaAuthApi(token, env.AGENT_AUTH_API_URL!),
  }),
);

api.post("/agents/register", registerAgent);

export default {
  port: env.PORT ?? 8082,
  fetch: api.fetch,
};
