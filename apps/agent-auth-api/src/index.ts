import { env } from "@workspace/env";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { createAPIKey } from "./routes/create-api-key";
import { deactivateAPIKey } from "./routes/deactivate-api-key";
import { deleteAPIKey } from "./routes/delete-api-key";
import { reactivateAPIKey } from "./routes/reactivate-api-key";
import { retrieveAPIKey } from "./routes/retrieve-api-key";
import { retrieveAPIKeys } from "./routes/retrieve-api-keys";
import { updateAPIKey } from "./routes/update-api-key";

const app = new Hono();
const api = app.basePath("/api/api-keys");

// Temporary auth
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

export default api;
