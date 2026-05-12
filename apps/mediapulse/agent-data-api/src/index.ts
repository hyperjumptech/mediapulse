import { domainHealthResponseSchema } from "@hermes/domain-contract/contracts";
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

import { getAnalysis, postAnalysis } from "./routes/analysis.js";
import { postAnalysisDataSourceDelete } from "./routes/analysis-data-source-delete.js";
import {
  getContentGeneration,
  getContentGenerationNewslettersLatest,
  postContentGeneration,
} from "./routes/content-generation.js";
import { postDataCollectionExistingUrls } from "./routes/data-collection-existing-urls.js";
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
  getUserRegistrationUnsubscribeHandler,
  postUserRegistrationUnsubscribeHandler,
} from "./routes/user-registration.js";
import {
  getQueryAnalysis,
  postQueryAnalysis,
} from "./routes/query-analysis.js";
import {
  getContentGenerationRuns,
  postContentGenerationRun,
} from "./routes/content-generation-run.js";
import {
  registerAgentDataApiRoutes,
  type AgentDataApiHandlers,
} from "./register-agent-data-api-routes.js";

if (!env.AGENT_AUTH_API_URL) {
  throw new Error("AGENT_AUTH_API_URL is required for agent-data-api");
}

/**
 * Builds the JSON body for the public liveness route `GET /health`.
 *
 * @returns Parsed payload matching the Hermes domain health contract.
 */
const buildAgentDataApiHealthBody = () =>
  domainHealthResponseSchema.parse({
    ok: true,
    service: "agent-data-api",
  });

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

app.get("/health", (c) => c.json(buildAgentDataApiHealthBody()));

const routeHandlers = {
  analysis: {
    get: getAnalysis,
    post: postAnalysis,
  },
  analysisDataSourceDelete: {
    post: postAnalysisDataSourceDelete,
  },
  contentGeneration: {
    get: getContentGeneration,
    post: postContentGeneration,
  },
  contentGenerationNewslettersLatest: {
    get: getContentGenerationNewslettersLatest,
  },
  dataCollection: {
    get: getDataCollection,
    post: postDataCollection,
  },
  dataCollectionExistingUrls: {
    post: postDataCollectionExistingUrls,
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
  queryAnalysis: {
    get: getQueryAnalysis,
    post: postQueryAnalysis,
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
  userRegistrationUnsubscribe: {
    get: getUserRegistrationUnsubscribeHandler,
    post: postUserRegistrationUnsubscribeHandler,
  },
  contentGenerationRuns: {
    get: getContentGenerationRuns,
    post: postContentGenerationRun,
  },
} satisfies AgentDataApiHandlers;

for (const version of AGENT_DATA_API_LIVE_VERSIONS) {
  const versionApi = new Hono();
  const unsubscribePath = `${AGENT_DATA_API_PREFIX}/${version}/user-registration-unsubscribe`;
  versionApi.use("*", async (context, next) => {
    const pathname = new URL(context.req.url).pathname;
    if (pathname === unsubscribePath) {
      return next();
    }
    return bearerAuth({
      verifyToken: (token) =>
        verifyTokenViaAuthApi(token, env.AGENT_AUTH_API_URL!),
    })(context, next);
  });
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
