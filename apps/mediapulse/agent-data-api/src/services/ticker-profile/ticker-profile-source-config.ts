import { createOrganonSparqlClient } from "./organon-sparql-client.js";
import { loadOrganonTickerProfiles } from "./organon-ticker-profiles.js";
import { createTickerProfileCache } from "./ticker-profile-cache.js";
import type { TickerProfileSource } from "./ticker-profile-source.js";

export const DEFAULT_TICKER_PROFILE_CACHE_TTL_MS = 600_000;

export const ORGANON_SPARQL_TIMEOUT_MS = 40_000;

export type TickerProfileSourceEnv = {
  ORGANON_API_URL?: string;
  ORGANON_API_KEY?: string;
  MEDIAPULSE_TICKER_PROFILE_CACHE_TTL_MS?: number;
};

export type TickerProfileSourceConfig = {
  baseUrl: string;
  apiKey: string;
  ttlMs: number;
};

export type ConfiguredTickerProfileSource = {
  source: TickerProfileSource;
  warm: () => Promise<void>;
};

type SourceLogger = {
  info: (details: object, message: string) => void;
  warn: (details: object, message: string) => void;
};

export type TickerProfileSourceDependencies = {
  fetchImpl?: typeof fetch;
  logger?: SourceLogger;
  now?: () => number;
};

const positiveOr = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

export const readTickerProfileSourceConfig = (
  source: TickerProfileSourceEnv,
): TickerProfileSourceConfig => {
  const baseUrl = source.ORGANON_API_URL?.trim() ?? "";
  if (baseUrl === "") {
    throw new Error("ORGANON_API_URL is required to read ticker profiles");
  }
  const apiKey = source.ORGANON_API_KEY?.trim() ?? "";
  if (apiKey === "") {
    throw new Error("ORGANON_API_KEY is required to read ticker profiles");
  }

  return {
    baseUrl,
    apiKey,
    ttlMs: positiveOr(
      source.MEDIAPULSE_TICKER_PROFILE_CACHE_TTL_MS,
      DEFAULT_TICKER_PROFILE_CACHE_TTL_MS,
    ),
  };
};

export const createTickerProfileSource = (
  config: TickerProfileSourceConfig,
  dependencies: TickerProfileSourceDependencies = {},
): ConfiguredTickerProfileSource => {
  const runSparql = createOrganonSparqlClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    timeoutMs: ORGANON_SPARQL_TIMEOUT_MS,
    fetchImpl: dependencies.fetchImpl,
  });

  return createTickerProfileCache({
    load: () => loadOrganonTickerProfiles(runSparql),
    ttlMs: config.ttlMs,
    now: dependencies.now,
    onLoaded: (details) => {
      dependencies.logger?.info(details, "Loaded ticker profiles from Organon");
    },
    onRefreshError: ({ error, snapshotAgeMs }) => {
      dependencies.logger?.warn(
        { err: error, snapshotAgeMs },
        "Loading ticker profiles from Organon failed",
      );
    },
  });
};
