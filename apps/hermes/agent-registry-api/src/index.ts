import { domainHealthResponseSchema } from "@hermes/domain-contract/contracts";
import { env } from "@hermes/env";
import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import { logger, slimHonoPinoHttpLoggerOptions } from "@workspace/logger";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import { registerAgent } from "./routes/register-agent";

if (!env.AGENT_AUTH_API_URL) {
  throw new Error("AGENT_AUTH_API_URL is required for agent-registry-api");
}

/**
 * Builds the JSON body for the public liveness route `GET /health`.
 *
 * @returns Parsed payload matching the Hermes domain health contract.
 */
const buildAgentRegistryApiHealthBody = () =>
  domainHealthResponseSchema.parse({
    ok: true,
    service: "agent-registry-api",
  });

const rootApp = new Hono();

rootApp.get("/health", (c) => c.json(buildAgentRegistryApiHealthBody()));

const api = new Hono();

api.use(
  pinoLogger({
    pino: logger,
    http: slimHonoPinoHttpLoggerOptions,
  }),
);

api.use(
  "*",
  bearerAuth({
    verifyToken: (token) =>
      verifyTokenViaAuthApi(token, env.AGENT_AUTH_API_URL!),
  }),
);

api.post("/agents/register", registerAgent);

rootApp.route("/api", api);

export default {
  port: env.PORT ?? 8082,
  fetch: rootApp.fetch,
};
