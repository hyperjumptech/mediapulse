import { verifyApiKeyViaAuthApi } from "@workspace/agent-auth-client";
import {
  AGENT_DATA_API_BASE_PATH,
  agentDataApiManifest,
} from "@workspace/agent-data-api-contract";
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
import {
  registerAgentDataApiRoutes,
  type AgentDataApiHandlers,
} from "./register-agent-data-api-routes.js";

if (!env.AGENT_AUTH_API_URL) {
  throw new Error("AGENT_AUTH_API_URL is required for agent-data-api");
}

const app = new Hono();
const api = app.basePath(AGENT_DATA_API_BASE_PATH);

app.use(
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

const routeHandlers = {
  contentGeneration: {
    get: getContentGeneration,
    post: postContentGeneration,
  },
  dataCollection: {
    get: getDataCollection,
    post: postDataCollection,
  },
  delivery: {
    get: getDelivery,
    post: postDeliveryHandler,
  },
} satisfies AgentDataApiHandlers;

registerAgentDataApiRoutes(api, agentDataApiManifest, routeHandlers);

export { app };
export default {
  port: env.PORT ?? 8081,
  fetch: app.fetch,
};
