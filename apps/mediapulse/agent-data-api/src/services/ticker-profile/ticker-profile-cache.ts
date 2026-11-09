import {
  keyProfilesBySymbol,
  pickTickerProfiles,
  type TickerProfileRecord,
  type TickerProfileSource,
} from "./ticker-profile-source.js";

export const DEFAULT_FAILURE_COOLDOWN_MS = 30_000;

type Snapshot = {
  profiles: ReadonlyMap<string, TickerProfileRecord>;
  loadedAt: number;
};

export type TickerProfileCacheOptions = {
  load: () => Promise<ReadonlyMap<string, TickerProfileRecord>>;
  ttlMs: number;
  failureCooldownMs?: number;
  now?: () => number;
  onLoaded?: (details: { tickerCount: number; durationMs: number }) => void;
  onRefreshError?: (details: {
    error: unknown;
    snapshotAgeMs: number | null;
  }) => void;
};

export type TickerProfileCache = {
  source: TickerProfileSource;
  warm: () => Promise<void>;
};

export const createTickerProfileCache = ({
  load,
  ttlMs,
  failureCooldownMs = DEFAULT_FAILURE_COOLDOWN_MS,
  now = Date.now,
  onLoaded,
  onRefreshError,
}: TickerProfileCacheOptions): TickerProfileCache => {
  let snapshot: Snapshot | undefined;
  let inFlight: Promise<Snapshot> | undefined;
  let lastFailure: { at: number; error: unknown } | undefined;

  const refresh = (): Promise<Snapshot> => {
    if (inFlight !== undefined) {
      return inFlight;
    }
    const startedAt = now();
    const attempt = load()
      .then(
        (profiles) => {
          const loaded: Snapshot = {
            profiles: keyProfilesBySymbol(profiles),
            loadedAt: now(),
          };
          snapshot = loaded;
          lastFailure = undefined;
          onLoaded?.({
            tickerCount: loaded.profiles.size,
            durationMs: loaded.loadedAt - startedAt,
          });

          return loaded;
        },
        (error: unknown) => {
          lastFailure = { at: now(), error };
          onRefreshError?.({
            error,
            snapshotAgeMs:
              snapshot === undefined ? null : now() - snapshot.loadedAt,
          });
          throw error;
        },
      )
      .finally(() => {
        inFlight = undefined;
      });
    inFlight = attempt;

    return attempt;
  };

  const isCoolingDown = (): boolean =>
    lastFailure !== undefined && now() - lastFailure.at < failureCooldownMs;

  const current = async (): Promise<Snapshot> => {
    if (snapshot === undefined) {
      if (inFlight !== undefined) {
        return inFlight;
      }
      if (lastFailure !== undefined && isCoolingDown()) {
        throw lastFailure.error;
      }

      return refresh();
    }
    const isStale = now() - snapshot.loadedAt >= ttlMs;
    if (isStale && inFlight === undefined && !isCoolingDown()) {
      refresh().catch(() => undefined);
    }

    return snapshot;
  };

  return {
    source: async (symbols) => {
      const { profiles } = await current();

      return pickTickerProfiles(profiles, symbols);
    },
    warm: async () => {
      await current();
    },
  };
};
