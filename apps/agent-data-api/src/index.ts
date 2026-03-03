import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import { env } from "@workspace/env";
import { logger } from "@workspace/logger";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";

import {
  getContentGeneration,
  postContentGeneration,
} from "./routes/content-generation.js";
import {
  getDataCollection,
  postDataCollection,
} from "./routes/data-collection.js";
import { getDelivery, postDeliveryHandler } from "./routes/delivery.js";

if (!env.AGENT_AUTH_API_URL) {
  throw new Error("AGENT_AUTH_API_URL is required for agent-data-api");
}

const app = new Hono();
const api = app.basePath("/api");

app.use(pinoLogger({ pino: logger }));
api.use(
  "*",
  bearerAuth({
    verifyToken: (token) =>
      verifyTokenViaAuthApi(token, env.AGENT_AUTH_API_URL!),
  }),
);

api.get("/content-generation", getContentGeneration);
api.post("/content-generation", postContentGeneration);

api.get("/data-collection", getDataCollection);
api.post("/data-collection", postDataCollection);

api.get("/delivery", getDelivery);
api.post("/delivery", postDeliveryHandler);

export { app };
export default {
  port: env.PORT ?? 8081,
  fetch: app.fetch,
};
