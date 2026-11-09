import {
  createDatabaseTickerProfileSource,
  type DatabaseTickerProfileDb,
} from "./database-ticker-profile-source.js";
import { createOrganonSparqlClient } from "./organon-sparql-client.js";
import { loadOrganonTickerProfiles } from "./organon-ticker-profiles.js";
import { createTickerProfileCache } from "./ticker-profile-cache.js";
import type { TickerProfileSource } from "./ticker-profile-source.js";

export const DEFAULT_TICKER_PROFILE_CACHE_TTL_MS = 600_000;

export const ORGANON_SPARQL_TIMEOUT_MS = 40_000;

export type TickerProfileSourceEnv = {
  MEDIAPULSE_TICKER_PROFILE_SOURCE?: string;
  ORGANON_API_URL?: string;
  ORGANON_API_KEY?: string;
  MEDIAPULSE_TICKER_PROFILE_CACHE_TTL_MS?: number;
};

export type TickerProfileSourceConfig =
  | { kind: "database" }
  | { kind: "organon"; baseUrl: string; apiKey: string; ttlMs: number };

export type ConfiguredTickerProfileSource = {
  kind: TickerProfileSourceConfig["kind"];
  source: TickerProfileSource;
  warm: () => Promise<void>;
};

type SourceLogger = {
  info: (details: object, message: string) => void;
  warn: (details: object, message: string) => void;
};

export type TickerProfileSourceDependencies = {
  tickerProfileDb?: DatabaseTickerProfileDb;
  fetchImpl?: typeof fetch;
  logger?: SourceLogger;
  now?: () => number;
};

const positiveOr = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

export const readTickerProfileSourceConfig = (
  source: TickerProfileSourceEnv,
): TickerProfileSourceConfig => {
  const kind = source.MEDIAPULSE_TICKER_PROFILE_SOURCE?.trim() || "database";
  if (kind === "database") {
    return { kind };
  }
  if (kind !== "organon") {
    throw new Error(
      `MEDIAPULSE_TICKER_PROFILE_SOURCE must be "database" or "organon", not "${kind}"`,
    );
  }
  const baseUrl = source.ORGANON_API_URL?.trim() ?? "";
  if (baseUrl === "") {
    throw new Error(
      "ORGANON_API_URL is required when MEDIAPULSE_TICKER_PROFILE_SOURCE is organon",
    );
  }
  const apiKey = source.ORGANON_API_KEY?.trim() ?? "";
  if (apiKey === "") {
    throw new Error(
      "ORGANON_API_KEY is required when MEDIAPULSE_TICKER_PROFILE_SOURCE is organon",
    );
  }

  return {
    kind,
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
  if (config.kind === "database") {
    if (dependencies.tickerProfileDb === undefined) {
      throw new Error(
        "The database profile source needs a tickerProfile delegate",
      );
    }

    return {
      kind: config.kind,
      source: createDatabaseTickerProfileSource(dependencies.tickerProfileDb),
      warm: async () => undefined,
    };
  }
  const runSparql = createOrganonSparqlClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    timeoutMs: ORGANON_SPARQL_TIMEOUT_MS,
    fetchImpl: dependencies.fetchImpl,
  });
  const cache = createTickerProfileCache({
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

  return { kind: config.kind, ...cache };
};
