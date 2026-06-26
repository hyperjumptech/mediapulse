import { domainHealthResponseSchema } from "@hermes/domain-contract/contracts";
import { env } from "@hermes/env";
import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import { logger, slimPinoLogger } from "@workspace/logger";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { registerAgent } from "./routes/register-agent";
import { unregisterAgent } from "./routes/unregister-agent";
import { postAgentActivity } from "./routes/agent-activity";

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

api.use(slimPinoLogger({ pino: logger }));

api.use(
  "*",
  bearerAuth({
    verifyToken: (token) =>
      verifyTokenViaAuthApi(token, env.AGENT_AUTH_API_URL!),
  }),
);

api.post("/agents/register", registerAgent);
api.post("/agents/unregister", unregisterAgent);
api.post("/agent-activity", postAgentActivity);

rootApp.route("/api", api);

export default {
  port: env.PORT ?? 8082,
  fetch: rootApp.fetch,
};
