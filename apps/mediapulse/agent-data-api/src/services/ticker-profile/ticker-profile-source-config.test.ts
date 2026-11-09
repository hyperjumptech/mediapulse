import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({ prisma: {} }));

import {
  DEFAULT_TICKER_PROFILE_CACHE_TTL_MS,
  createTickerProfileSource,
  readTickerProfileSourceConfig,
} from "./ticker-profile-source-config.js";

const MP = "https://mediapulse.hyperjump.tech/ontology#";

describe("readTickerProfileSourceConfig", () => {
  it("defaults to the database", () => {
    expect(readTickerProfileSourceConfig({})).toEqual({ kind: "database" });
    expect(
      readTickerProfileSourceConfig({ MEDIAPULSE_TICKER_PROFILE_SOURCE: " " }),
    ).toEqual({ kind: "database" });
  });

  it("reads the Organon settings and falls back to the default TTL", () => {
    expect(
      readTickerProfileSourceConfig({
        MEDIAPULSE_TICKER_PROFILE_SOURCE: "organon",
        ORGANON_API_URL: " https://organon.example ",
        ORGANON_API_KEY: "organon_key",
        MEDIAPULSE_TICKER_PROFILE_CACHE_TTL_MS: 0,
      }),
    ).toEqual({
      kind: "organon",
      baseUrl: "https://organon.example",
      apiKey: "organon_key",
      ttlMs: DEFAULT_TICKER_PROFILE_CACHE_TTL_MS,
    });
  });

  it("names the missing Organon setting", () => {
    expect(() =>
      readTickerProfileSourceConfig({
        MEDIAPULSE_TICKER_PROFILE_SOURCE: "organon",
        ORGANON_API_KEY: "organon_key",
      }),
    ).toThrow("ORGANON_API_URL is required");
    expect(() =>
      readTickerProfileSourceConfig({
        MEDIAPULSE_TICKER_PROFILE_SOURCE: "organon",
        ORGANON_API_URL: "https://organon.example",
      }),
    ).toThrow("ORGANON_API_KEY is required");
  });

  it("rejects an unknown source", () => {
    expect(() =>
      readTickerProfileSourceConfig({
        MEDIAPULSE_TICKER_PROFILE_SOURCE: "csv",
      }),
    ).toThrow('must be "database" or "organon"');
  });
});

describe("createTickerProfileSource", () => {
  it("reads Organon through the cache", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_url, init) => {
        const query = String(init?.body ?? "");
        const bindings = query.includes("?property")
          ? [
              {
                ticker: { type: "literal", value: "MAPB" },
                property: { type: "uri", value: `${MP}companyOverview` },
                value: {
                  type: "literal",
                  value: "Overview.",
                  "xml:lang": "en",
                },
              },
            ]
          : [];

        return new Response(
          JSON.stringify({ head: { vars: [] }, results: { bindings } }),
        );
      });
    const configured = createTickerProfileSource(
      {
        kind: "organon",
        baseUrl: "https://organon.example",
        apiKey: "organon_key",
        ttlMs: 1000,
      },
      { fetchImpl, now: () => 0 },
    );

    const first = await configured.source(["MAPB"]);
    await configured.source(["MAPB"]);

    expect(configured.kind).toBe("organon");
    expect(first.get("MAPB")?.companyOverview).toBe("Overview.");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reads the database for the database source", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const configured = createTickerProfileSource(
      { kind: "database" },
      { tickerProfileDb: { tickerProfile: { findMany } } },
    );

    await configured.warm();
    await configured.source(["MAPB"]);

    expect(configured.kind).toBe("database");
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
