import { env } from "@mediapulse/env";
import { logger } from "@workspace/logger";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import {
  HERMES_DASHBOARD_V1_MOUNT_PATH,
  hermesDashboardTableMountPath,
} from "../hermes-dashboard/paths";
import { hermesDashboardRouteMounts } from "./hermes-dashboard-route-mounts";
import { healthRoutes } from "./routes/health-routes";
import { hermesDashboardManifestRoutes } from "./routes/hermes-dashboard-manifest-routes";
import { stepInputExpansionRoutes } from "./routes/step-input-expansion-routes";
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
  const api = app.basePath("/v1");

  api.use(
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

  if (env.AGENT_AUTH_API_URL?.trim()) {
    api.use("*", async (c, next) => {
      const path = new URL(c.req.url).pathname;
      if (path.endsWith("/health")) {
        return next();
      }
      const ok = await verifyInvocationJwtFromHeader(
        c.req.header("Authorization"),
      );
      if (!ok) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      return next();
    });
  }

  api.route("/health", healthRoutes);

  for (const { segment, app: subApp } of hermesDashboardRouteMounts) {
    api.route(hermesDashboardTableMountPath(segment), subApp);
  }

  api.route(HERMES_DASHBOARD_V1_MOUNT_PATH, hermesDashboardManifestRoutes);
  api.route("/", stepInputExpansionRoutes);

  return {
    port: env.PORT ?? 8090,
    fetch: api.fetch,
  };
};
