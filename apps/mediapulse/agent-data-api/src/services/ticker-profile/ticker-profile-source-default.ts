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
    createTickerProfileSource(readTickerProfileSourceConfig(env), { logger }),
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
  configuredSource.warm().catch(() => undefined);
};
