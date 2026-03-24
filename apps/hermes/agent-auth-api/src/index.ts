import { env } from "@hermes/env";
import { logger } from "@workspace/logger";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { issueToken } from "./routes/issue-token";
import { verifyJwt } from "./routes/verify-jwt";

const mainApp = new Hono();
mainApp.use(
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

/** POST /api/verify — JWT-only invocation verification (agents). */
mainApp.post("/api/verify", verifyJwt);

/** POST /api/token — issue short-lived JWT (internal preset or domain integration API key). */
mainApp.post("/api/token", issueToken);

export default {
  port: env.PORT ?? 8080,
  fetch: mainApp.fetch,
};
