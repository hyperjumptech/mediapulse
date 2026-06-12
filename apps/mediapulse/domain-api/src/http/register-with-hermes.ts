import { registerDomainIntegrationRequestSchema } from "@hermes/domain-contract";
import { env } from "@mediapulse/env";
import { logger } from "@workspace/logger";
import { z } from "zod";
import { dashboardManifest } from "../hermes-dashboard/manifest";
import {
  getBackoffDelayMs,
  REGISTRATION_MAX_ATTEMPTS,
  shouldRetryStatus,
  sleep,
} from "../lib/registration-retry";

/**
 * Registers this domain integration with Hermes.
 *
 * @returns Promise that resolves once registration call completes.
 */
export const registerWithHermes = async (): Promise<void> => {
  if (
    !env.HERMES_API_URL ||
    !env.DOMAIN_INTEGRATION_API_KEY ||
    !env.MEDIAPULSE_API_URL
  ) {
    logger.info(
      "Skipping Hermes domain integration registration (missing HERMES_API_URL, DOMAIN_INTEGRATION_API_KEY, or MEDIAPULSE_API_URL)",
    );
    return;
  }

  const requestBody = registerDomainIntegrationRequestSchema.parse({
    integrationId: env.DOMAIN_INTEGRATION_ID,
    name: env.DOMAIN_INTEGRATION_NAME ?? "Mediapulse",
    baseUrl: env.MEDIAPULSE_API_URL,
    version: env.DOMAIN_INTEGRATION_VERSION,
    capabilities: [
      "expand-step-inputs",
      "preview-expansion",
      "operator-diagnostics",
    ],
    isDefault: true,
    dashboard: dashboardManifest,
  });

  for (let attempt = 1; attempt <= REGISTRATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(
        `${env.HERMES_API_URL.replace(/\/$/, "")}/api/domain-integrations/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.DOMAIN_INTEGRATION_API_KEY}`,
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (response.ok) {
        logger.info({ attempt }, "Domain integration registered successfully");
        return;
      }

      const body = z
        .unknown()
        .catch(undefined)
        .parse(await response.json().catch(() => undefined));
      const retryable = shouldRetryStatus(response.status);
      if (!retryable || attempt === REGISTRATION_MAX_ATTEMPTS) {
        logger.error(
          { status: response.status, body, attempt },
          "Domain integration registration failed",
        );
        return;
      }

      const delayMs = getBackoffDelayMs(attempt);
      logger.warn(
        { status: response.status, body, attempt, delayMs },
        "Domain integration registration failed; retrying",
      );
      await sleep(delayMs);
    } catch (error) {
      if (attempt === REGISTRATION_MAX_ATTEMPTS) {
        logger.error(
          { attempt, error },
          "Domain integration registration failed with network error",
        );
        return;
      }

      const delayMs = getBackoffDelayMs(attempt);
      logger.warn(
        { attempt, delayMs, error },
        "Domain integration registration failed; retrying",
      );
      await sleep(delayMs);
    }
  }
};
