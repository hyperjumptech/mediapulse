import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_TICKER_PROFILE_CACHE_TTL_MS,
  createTickerProfileSource,
  readTickerProfileSourceConfig,
} from "./ticker-profile-source-config.js";

const MP = "https://mediapulse.hyperjump.tech/ontology#";

describe("readTickerProfileSourceConfig", () => {
  it("reads the knowledge graph settings and falls back to the default TTL", () => {
    expect(
      readTickerProfileSourceConfig({
        ORGANON_API_URL: " https://organon.example ",
        ORGANON_API_KEY: "organon_key",
        MEDIAPULSE_TICKER_PROFILE_CACHE_TTL_MS: 0,
      }),
    ).toEqual({
      baseUrl: "https://organon.example",
      apiKey: "organon_key",
      ttlMs: DEFAULT_TICKER_PROFILE_CACHE_TTL_MS,
    });
  });

  it("keeps a positive TTL", () => {
    expect(
      readTickerProfileSourceConfig({
        ORGANON_API_URL: "https://organon.example",
        ORGANON_API_KEY: "organon_key",
        MEDIAPULSE_TICKER_PROFILE_CACHE_TTL_MS: 5000,
      }).ttlMs,
    ).toBe(5000);
  });

  it("names the missing setting", () => {
    expect(() => readTickerProfileSourceConfig({})).toThrow(
      "ORGANON_API_URL is required",
    );
    expect(() =>
      readTickerProfileSourceConfig({ ORGANON_API_KEY: "organon_key" }),
    ).toThrow("ORGANON_API_URL is required");
    expect(() =>
      readTickerProfileSourceConfig({
        ORGANON_API_URL: "https://organon.example",
      }),
    ).toThrow("ORGANON_API_KEY is required");
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
        baseUrl: "https://organon.example",
        apiKey: "organon_key",
        ttlMs: 1000,
      },
      { fetchImpl, now: () => 0 },
    );

    const first = await configured.source(["MAPB"]);
    await configured.source(["MAPB"]);

    expect(first.get("MAPB")?.companyOverview).toBe("Overview.");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
