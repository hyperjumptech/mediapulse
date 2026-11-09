import { prisma } from "@mediapulse/database";
import { env } from "@mediapulse/env";
import { logger } from "@workspace/logger";

import {
  createTickerProfileSource,
  readTickerProfileSourceConfig,
  type ConfiguredTickerProfileSource,
} from "./ticker-profile-source-config.js";
import type { TickerProfileSource } from "./ticker-profile-source.js";

let configured: ConfiguredTickerProfileSource | undefined;

const getConfigured = (): ConfiguredTickerProfileSource => {
  if (configured === undefined) {
    configured = createTickerProfileSource(readTickerProfileSourceConfig(env), {
      tickerProfileDb: { tickerProfile: prisma.tickerProfile },
      logger,
    });
  }

  return configured;
};

export const defaultTickerProfileSource: TickerProfileSource = (symbols) =>
  getConfigured().source(symbols);

export const startDefaultTickerProfileSource = (): void => {
  const source = getConfigured();
  logger.info({ kind: source.kind }, "Ticker profile source");
  if (source.kind === "organon") {
    source.warm().catch(() => undefined);
  }
};
