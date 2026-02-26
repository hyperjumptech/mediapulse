import { verifyAPIKey } from "@workspace/agent-utils";
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

const app = new Hono();
const api = app.basePath("/api");

app.use(pinoLogger({ pino: logger }));
api.use("*", bearerAuth({ verifyToken: async (token) => verifyAPIKey(token) }));

api.get("/content-generation", getContentGeneration);
api.post("/content-generation", postContentGeneration);

api.get("/data-collection", getDataCollection);
api.post("/data-collection", postDataCollection);

api.get("/delivery", getDelivery);
api.post("/delivery", postDeliveryHandler);

export default app;
