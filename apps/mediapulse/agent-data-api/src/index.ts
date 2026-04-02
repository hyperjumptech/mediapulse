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
import {
  getDataCollectionRun,
  postDataCollectionRun,
} from "./routes/data-collection-run.js";
import {
  getDataCollectionFailure,
  postDataCollectionFailure,
} from "./routes/data-collection-failure.js";
import { getDeliveryRun, postDeliveryRun } from "./routes/delivery-run.js";
import { getDelivery, postDeliveryHandler } from "./routes/delivery.js";
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
  contentGeneration: {
    get: getContentGeneration,
    post: postContentGeneration,
  },
  dataCollection: {
    get: getDataCollection,
    post: postDataCollection,
  },
  dataCollectionRun: {
    get: getDataCollectionRun,
    post: postDataCollectionRun,
  },
  dataCollectionFailure: {
    get: getDataCollectionFailure,
    post: postDataCollectionFailure,
  },
  delivery: {
    get: getDelivery,
    post: postDeliveryHandler,
  },
  deliveryRun: {
    get: getDeliveryRun,
    post: postDeliveryRun,
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
