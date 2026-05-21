import { domainHealthResponseSchema } from "@hermes/domain-contract/contracts";
import { env } from "@hermes/env";
import { logger, slimPinoLogger } from "@workspace/logger";
import { Hono } from "hono";
import { issueToken } from "./routes/issue-token";
import { verifyJwt } from "./routes/verify-jwt";

/**
 * Builds the JSON body for the public liveness route `GET /health`.
 *
 * @returns Parsed payload matching the Hermes domain health contract.
 */
const buildAgentAuthApiHealthBody = () =>
  domainHealthResponseSchema.parse({
    ok: true,
    service: "agent-auth-api",
  });

const mainApp = new Hono();
mainApp.use(slimPinoLogger({ pino: logger }));

/** GET /health — public liveness for load balancers. */
mainApp.get("/health", (c) => c.json(buildAgentAuthApiHealthBody()));

/** POST /api/verify — JWT-only invocation verification (agents). */
mainApp.post("/api/verify", verifyJwt);

/** POST /api/token — issue short-lived JWT (internal preset or domain integration API key). */
mainApp.post("/api/token", issueToken);

/** Bun / `serve` entry shape; explicit typing so `import().default` is not inferred as the module namespace. */
const agentAuthApiServer: {
  port: number;
  fetch: typeof mainApp.fetch;
} = {
  port: env.PORT ?? 8080,
  fetch: mainApp.fetch,
};

export { agentAuthApiServer };
export default agentAuthApiServer;
