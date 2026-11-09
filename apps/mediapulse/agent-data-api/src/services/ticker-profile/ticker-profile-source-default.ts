import { prisma } from "@mediapulse/database";
import { logger } from "@workspace/logger";

import {
  createTickerProfileSource,
  readTickerProfileSourceConfig,
  type ConfiguredTickerProfileSource,
} from "./ticker-profile-source-config.js";
import type { TickerProfileSource } from "./ticker-profile-source.js";

let configured: Promise<ConfiguredTickerProfileSource> | undefined;

const getConfigured = (): Promise<ConfiguredTickerProfileSource> => {
  configured ??= import("@mediapulse/env").then(({ env }) =>
    createTickerProfileSource(readTickerProfileSourceConfig(env), {
      tickerProfileDb: { tickerProfile: prisma.tickerProfile },
      logger,
    }),
  );

  return configured;
};

export const defaultTickerProfileSource: TickerProfileSource = async (
  symbols,
) => {
  const configuredSource = await getConfigured();

  return configuredSource.source(symbols);
};

export const startDefaultTickerProfileSource = async (): Promise<void> => {
  const configuredSource = await getConfigured();
  logger.info({ kind: configuredSource.kind }, "Ticker profile source");
  if (configuredSource.kind === "organon") {
    configuredSource.warm().catch(() => undefined);
  }
};
