import { env } from "@workspace/env";
import { logger } from "@workspace/logger";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { pinoLogger } from "hono-pino";
import { createAPIKey } from "./routes/create-api-key";
import { deactivateAPIKey } from "./routes/deactivate-api-key";
import { deleteAPIKey } from "./routes/delete-api-key";
import { issueToken } from "./routes/issue-token";
import { reactivateAPIKey } from "./routes/reactivate-api-key";
import { retrieveAPIKey } from "./routes/retrieve-api-key";
import { retrieveAPIKeys } from "./routes/retrieve-api-keys";
import { updateAPIKey } from "./routes/update-api-key";
import { verifyApiKey } from "./routes/verify-api-key";
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
/** POST /api/verify-api-key — API-key verification for service callers (agent-data-api, agent-registry-api). */
mainApp.post("/api/verify-api-key", verifyApiKey);

/** POST /api/token — issue short-lived JWT; callers use Authorization: Bearer <scheduler api_key> */
mainApp.post("/api/token", issueToken);

const api = mainApp.basePath("/api/api-keys");

// Temporary auth for API key CRUD
api.use(
  "*",
  basicAuth({
    username: env.TEMP_ADMIN_USERNAME,
    password: env.TEMP_ADMIN_PASSWORD,
  }),
);

api.post("/", createAPIKey);
api.get("/", retrieveAPIKeys);
api.get("/:id", retrieveAPIKey);
api.patch("/:id", updateAPIKey);
api.delete("/:id", deleteAPIKey);
api.post("/:id/deactivate", deactivateAPIKey);
api.post("/:id/reactivate", reactivateAPIKey);

export default {
  port: env.PORT ?? 8080,
  fetch: mainApp.fetch,
};
