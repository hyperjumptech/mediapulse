import { describe, expect, it, vi } from "vitest";

import { createTickerProfileCache } from "./ticker-profile-cache.js";
import type { TickerProfileRecord } from "./ticker-profile-source.js";

const profileWithOverview = (companyOverview: string): TickerProfileRecord => ({
  companyOverview,
  businessOperation: "",
  companyOverviewIndonesian: "",
  businessOperationIndonesian: "",
  names: [],
  brands: [],
  subsidiaries: [],
  ambiguousNames: [],
  commodities: [],
  regulations: [],
  sectorIndonesian: "",
  sectorEnglish: "",
  subSectorIndonesian: "",
  subSectorEnglish: "",
  industryIndonesian: "",
  industryEnglish: "",
  subIndustryIndonesian: "",
  subIndustryEnglish: "",
  aliases: [],
  competitors: [],
  regulators: [],
});

const deferred = <Value>() => {
  let resolve: (value: Value) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const snapshot = (overview: string) =>
  new Map([["MAPB", profileWithOverview(overview)]]);

describe("createTickerProfileCache", () => {
  it("shares one load between callers while the cache is cold", async () => {
    const pending = deferred<Map<string, TickerProfileRecord>>();
    const load = vi.fn(() => pending.promise);
    const cache = createTickerProfileCache({ load, ttlMs: 1000, now: () => 0 });

    const first = cache.source(["MAPB"]);
    const second = cache.source(["mapb"]);
    pending.resolve(snapshot("first"));

    expect((await first).get("MAPB")?.companyOverview).toBe("first");
    expect((await second).get("mapb")?.companyOverview).toBe("first");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves from memory inside the TTL", async () => {
    let currentTime = 0;
    const load = vi.fn(async () => snapshot("first"));
    const cache = createTickerProfileCache({
      load,
      ttlMs: 1000,
      now: () => currentTime,
    });

    await cache.source(["MAPB"]);
    currentTime = 999;
    await cache.source(["MAPB"]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves the stale copy while one background refresh runs", async () => {
    let currentTime = 0;
    const refreshed = deferred<Map<string, TickerProfileRecord>>();
    const load = vi
      .fn<() => Promise<Map<string, TickerProfileRecord>>>()
      .mockResolvedValueOnce(snapshot("first"))
      .mockReturnValueOnce(refreshed.promise);
    const cache = createTickerProfileCache({
      load,
      ttlMs: 1000,
      now: () => currentTime,
    });
    await cache.source(["MAPB"]);
    currentTime = 1500;

    const duringRefresh = await cache.source(["MAPB"]);
    const alsoDuringRefresh = await cache.source(["MAPB"]);
    refreshed.resolve(snapshot("second"));
    await refreshed.promise;
    await Promise.resolve();
    const afterRefresh = await cache.source(["MAPB"]);

    expect(duringRefresh.get("MAPB")?.companyOverview).toBe("first");
    expect(alsoDuringRefresh.get("MAPB")?.companyOverview).toBe("first");
    expect(afterRefresh.get("MAPB")?.companyOverview).toBe("second");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps the stale copy when a refresh fails and waits for the cooldown before retrying", async () => {
    let currentTime = 0;
    const onRefreshError = vi.fn();
    const load = vi
      .fn<() => Promise<Map<string, TickerProfileRecord>>>()
      .mockResolvedValueOnce(snapshot("first"))
      .mockRejectedValueOnce(new Error("Organon is down"))
      .mockResolvedValueOnce(snapshot("third"));
    const cache = createTickerProfileCache({
      load,
      ttlMs: 1000,
      failureCooldownMs: 30_000,
      now: () => currentTime,
      onRefreshError,
    });
    await cache.source(["MAPB"]);
    currentTime = 2000;

    const whileFailing = await cache.source(["MAPB"]);
    await vi.waitFor(() => expect(onRefreshError).toHaveBeenCalledTimes(1));
    currentTime = 3000;
    const insideCooldown = await cache.source(["MAPB"]);
    currentTime = 40_000;
    await cache.source(["MAPB"]);
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(3));

    expect(whileFailing.get("MAPB")?.companyOverview).toBe("first");
    expect(insideCooldown.get("MAPB")?.companyOverview).toBe("first");
    expect(onRefreshError.mock.calls[0]?.[0]).toMatchObject({
      snapshotAgeMs: 2000,
    });
  });

  it("rejects cold callers when the first load fails, fails fast inside the cooldown, and retries after it", async () => {
    let currentTime = 0;
    const load = vi
      .fn<() => Promise<Map<string, TickerProfileRecord>>>()
      .mockRejectedValueOnce(new Error("Organon is down"))
      .mockResolvedValueOnce(snapshot("recovered"));
    const cache = createTickerProfileCache({
      load,
      ttlMs: 1000,
      failureCooldownMs: 30_000,
      now: () => currentTime,
    });

    await expect(cache.source(["MAPB"])).rejects.toThrow("Organon is down");
    currentTime = 10_000;
    await expect(cache.source(["MAPB"])).rejects.toThrow("Organon is down");
    currentTime = 31_000;
    const recovered = await cache.source(["MAPB"]);

    expect(load).toHaveBeenCalledTimes(2);
    expect(recovered.get("MAPB")?.companyOverview).toBe("recovered");
  });

  it("warms the cache and reports how many tickers it loaded", async () => {
    const onLoaded = vi.fn();
    const load = vi.fn(async () => snapshot("first"));
    const cache = createTickerProfileCache({
      load,
      ttlMs: 1000,
      now: () => 0,
      onLoaded,
    });

    await cache.warm();
    await cache.source(["MAPB"]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(onLoaded).toHaveBeenCalledWith({ tickerCount: 1, durationMs: 0 });
  });
});
