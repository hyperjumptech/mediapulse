import { env } from "@mediapulse/env";
import { logger } from "@workspace/logger";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import {
  HERMES_DASHBOARD_V1_MOUNT_PATH,
  hermesDashboardTableMountPath,
} from "../domain/hermes-dashboard-paths";
import { hermesDashboardTableRouteMounts } from "./hermes-table-route-mounts";
import { registerWithHermes } from "./register-with-hermes";
import { healthRoutes } from "./routes/health-routes";
import { hermesDashboardManifestRoutes } from "./routes/hermes-dashboard-manifest-routes";
import { stepInputExpansionRoutes } from "./routes/step-input-expansion-routes";

/**
 * Builds the Mediapulse domain API Hono application (middleware, versioned routes, Hermes registration).
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

  if (env.DOMAIN_INTEGRATION_AUTH_TOKEN) {
    api.use(
      "*",
      bearerAuth({
        verifyToken: (token) => token === env.DOMAIN_INTEGRATION_AUTH_TOKEN,
      }),
    );
  }

  api.route("/health", healthRoutes);

  for (const { segment, app: subApp } of hermesDashboardTableRouteMounts) {
    api.route(hermesDashboardTableMountPath(segment), subApp);
  }

  api.route(HERMES_DASHBOARD_V1_MOUNT_PATH, hermesDashboardManifestRoutes);
  api.route("/", stepInputExpansionRoutes);

  void registerWithHermes();

  return {
    port: env.PORT ?? 8090,
    fetch: api.fetch,
  };
};
