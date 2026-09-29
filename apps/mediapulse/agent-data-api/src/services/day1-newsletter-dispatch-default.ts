import { prisma as mediapulsePrisma } from "@mediapulse/database";
import { env } from "@mediapulse/env";
import { logger } from "@workspace/logger";

import {
  createDay1NewsletterDispatcher,
  readDay1DispatcherConfig,
  type Day1Activation,
  type Day1Dispatcher,
} from "./day1-newsletter-dispatch.js";
import { createHermesHttpTriggerClient } from "./hermes-http-trigger-client.js";

let defaultDispatcher: Day1Dispatcher | null | undefined;

const getDefaultDispatcher = (): Day1Dispatcher | null => {
  if (defaultDispatcher !== undefined) {
    return defaultDispatcher;
  }
  const config = readDay1DispatcherConfig(env);
  defaultDispatcher =
    config === null
      ? null
      : createDay1NewsletterDispatcher({
          db: mediapulsePrisma,
          invokeTrigger: createHermesHttpTriggerClient({
            baseUrl: env.HERMES_API_URL,
            timeoutMs: config.triggerTimeoutMs,
          }),
          config,
        });

  return defaultDispatcher;
};

export const notifySubscriptionActivated = (
  activation: Day1Activation,
): void => {
  const dispatcher = getDefaultDispatcher();
  if (dispatcher === null) {
    return;
  }
  void dispatcher(activation)
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
