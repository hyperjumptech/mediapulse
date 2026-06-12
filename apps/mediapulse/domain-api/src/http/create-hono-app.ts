import { env } from "@mediapulse/env";
import { logger, slimPinoLogger } from "@workspace/logger";
import { Hono } from "hono";
import { hermesDashboardContentViewRoutes } from "../hermes-dashboard/content-views/routes";
import {
  HERMES_DASHBOARD_V1_MOUNT_PATH,
  hermesDashboardTableMountPath,
} from "../hermes-dashboard/paths";
import { hermesDashboardRouteMounts } from "./hermes-dashboard-route-mounts";
import { healthRoutes } from "./routes/health-routes";
import { hermesDashboardManifestRoutes } from "./routes/hermes-dashboard-manifest-routes";
import { stepInputExpansionRoutes } from "./routes/step-input-expansion-routes";
import { unsubscribeRoutes } from "./routes/unsubscribe-routes";
import { verifyInvocationJwtFromHeader } from "./verify-invocation-jwt-middleware";

/**
 * Builds the Mediapulse domain API Hono application (middleware, versioned routes).
 * Hermes self-registration runs from the process entrypoint after this returns (see `src/index.ts`).
 *
 * @returns Bun-style server handle with `port` and `fetch`.
 */
export const createDomainApiServer = (): {
  port: number;
  fetch: Hono["fetch"];
} => {
  const app = new Hono();

  app.use(slimPinoLogger({ pino: logger }));

  // Public routes — no agent-auth JWT required.
  app.route("/api", unsubscribeRoutes);

  if (!env.UNSUBSCRIBE_SECRET) {
    logger.warn(
      "UNSUBSCRIBE_SECRET is not set — unsubscribe endpoints will return safe fallback responses",
    );
  }

  /** Liveness for load balancers; same contract as Hermes `GET /health` on domain integrations. */
  app.route("/health", healthRoutes);

  const api = app.basePath("/v1");

  if (env.AGENT_AUTH_API_URL?.trim()) {
    api.use("*", async (c, next) => {
      const ok = await verifyInvocationJwtFromHeader(
        c.req.header("Authorization"),
      );
      if (!ok) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      return next();
    });
  }

  for (const { segment, app: subApp } of hermesDashboardRouteMounts) {
    api.route(hermesDashboardTableMountPath(segment), subApp);
  }

  api.route(HERMES_DASHBOARD_V1_MOUNT_PATH, hermesDashboardManifestRoutes);
  api.route(
    `${HERMES_DASHBOARD_V1_MOUNT_PATH}/content`,
    hermesDashboardContentViewRoutes,
  );
  api.route("/", stepInputExpansionRoutes);

  return {
    port: env.PORT ?? 8090,
    fetch: app.fetch,
  };
};
