import { describe, expect, it } from "vitest";

import { ConfigSchema } from "./config-schema.js";

describe("ConfigSchema", () => {
  it("needs only the cutover and fills the rest from defaults and Hermes variables", () => {
    const config = ConfigSchema.parse({
      sendFrom: "2026-11-20T00:00:00+07:00",
    });

    expect(config).toEqual({
      organonUrl: "{{ORGANON_API_URL}}",
      organonApiKey: "{{ORGANON_INGESTION_API_KEY}}",
      sendFrom: "2026-11-20T00:00:00+07:00",
      lookbackDays: 7,
      maxSendsPerRun: 200,
      maxFetchesPerRun: 200,
      concurrency: 2,
      requestTimeoutMs: 30_000,
      fetch: {
        providers: [
          expect.objectContaining({
            provider: "serper",
            apiKey: "{{SERPER_API_KEY}}",
          }),
          expect.objectContaining({
            provider: "diffbot",
            apiKey: "{{DIFFBOT_API_KEY}}",
          }),
        ],
      },
      resilience: {
        deadUrlCache: { enabled: true, skipLookupBatchSize: 50 },
        hostErrorBreaker: {
          enabled: true,
          minAttempts: 5,
          errorRateThreshold: 0.5,
        },
      },
      evidenceCheck: { enabled: true, lookbackHours: 24, maxArticles: 200 },
      dryRun: false,
    });
  });

  it("refuses a config without a cutover", () => {
    expect(ConfigSchema.safeParse({}).success).toBe(false);
  });

  it("refuses more concurrent sends than Organon should take from one caller", () => {
    expect(
      ConfigSchema.safeParse({
        sendFrom: "2026-11-20T00:00:00+07:00",
        concurrency: 9,
      }).success,
    ).toBe(false);
  });
});
