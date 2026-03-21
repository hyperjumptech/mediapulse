import { domainHealthResponseSchema } from "@hermes/domain-contract";
import { env } from "@mediapulse/env";
import { Hono } from "hono";

/**
 * Public liveness endpoint for load balancers and orchestration.
 */
export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => {
  const response = domainHealthResponseSchema.parse({
    ok: true,
    service: env.DOMAIN_INTEGRATION_NAME ?? "Mediapulse",
    version: env.DOMAIN_INTEGRATION_VERSION,
  });
  return c.json(response);
});
