import { env } from "@workspace/env";
import { logger } from "@workspace/logger";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { pinoLogger } from "hono-pino";
import { createAPIKey } from "./routes/create-api-key";
import { deactivateAPIKey } from "./routes/deactivate-api-key";
import { deleteAPIKey } from "./routes/delete-api-key";
import { reactivateAPIKey } from "./routes/reactivate-api-key";
import { retrieveAPIKey } from "./routes/retrieve-api-key";
import { retrieveAPIKeys } from "./routes/retrieve-api-keys";
import { updateAPIKey } from "./routes/update-api-key";
import { verifyApiKey } from "./routes/verify-api-key";

const mainApp = new Hono();
mainApp.use(pinoLogger({ pino: logger }));

/** POST /api/verify — no basicAuth; callers use Authorization: Bearer <key> */
mainApp.post("/api/verify", verifyApiKey);

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
