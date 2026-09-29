import { prisma as mediapulsePrisma } from "@mediapulse/database";
import { env } from "@mediapulse/env";
import { logger } from "@workspace/logger";

import {
  createDay1NewsletterDispatcher,
  readDay1DispatcherConfig,
  type Day1Activation,
  type Day1Dispatcher,
} from "./day1-newsletter-dispatch.js";
import { createHermesDomainEventClient } from "./hermes-domain-event-client.js";

let defaultDispatcher: Day1Dispatcher | undefined;

const getDefaultDispatcher = (): Day1Dispatcher => {
  if (defaultDispatcher !== undefined) {
    return defaultDispatcher;
  }
  const config = readDay1DispatcherConfig(env);
  defaultDispatcher = createDay1NewsletterDispatcher({
    db: mediapulsePrisma,
    sendEvent: createHermesDomainEventClient({
      baseUrl: env.HERMES_API_URL,
      apiKey: env.DOMAIN_INTEGRATION_API_KEY,
      timeoutMs: config.eventTimeoutMs,
    }),
    config,
  });

  return defaultDispatcher;
};

export const notifySubscriptionActivated = (
  activation: Day1Activation,
): void => {
  void getDefaultDispatcher()(activation)
    .then((outcome) => {
      logger.info(
        { userTickerId: activation.userTickerId, ...outcome },
        "Day 1 newsletter dispatch",
      );
    })
    .catch((error: unknown) => {
      logger.error(
        { err: error, userTickerId: activation.userTickerId },
        "Day 1 newsletter dispatch failed",
      );
    });
};
