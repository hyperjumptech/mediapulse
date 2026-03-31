import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import {
  AGENT_DATA_API_LIVE_VERSIONS,
  AGENT_DATA_API_PREFIX,
  agentDataApiManifestForVersion,
} from "@workspace/agent-data-api-contract";
import { env } from "@mediapulse/env";
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
  getQueryAnalysis,
  postQueryAnalysis,
} from "./routes/query-analysis.js";
import {
  postUserRegistrationRegisterHandler,
  postUserRegistrationConfirmHandler,
} from "./routes/user-registration.js";
import {
  registerAgentDataApiRoutes,
  type AgentDataApiHandlers,
} from "./register-agent-data-api-routes.js";

if (!env.AGENT_AUTH_API_URL) {
  throw new Error("AGENT_AUTH_API_URL is required for agent-data-api");
}

const app = new Hono();

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
const routeHandlers = {
  queryAnalysis: {
    get: getQueryAnalysis,
    post: postQueryAnalysis,
  },
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
  userRegistrationRegister: {
    post: postUserRegistrationRegisterHandler,
  },
  userRegistrationConfirm: {
    post: postUserRegistrationConfirmHandler,
  },
} satisfies AgentDataApiHandlers;

for (const version of AGENT_DATA_API_LIVE_VERSIONS) {
  const versionApi = new Hono();
  versionApi.use(
    "*",
    bearerAuth({
      verifyToken: (token) =>
        verifyTokenViaAuthApi(token, env.AGENT_AUTH_API_URL!),
    }),
  );
  registerAgentDataApiRoutes(
    versionApi,
    agentDataApiManifestForVersion(version),
    routeHandlers,
  );
  app.route(`${AGENT_DATA_API_PREFIX}/${version}`, versionApi);
}

export { app };
export default {
  port: env.PORT ?? 8081,
  fetch: app.fetch,
};
