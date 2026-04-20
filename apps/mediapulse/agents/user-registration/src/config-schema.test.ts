import { describe, expect, it } from "vitest";

import { ConfigSchema } from "./config-schema.js";

describe("user-registration ConfigSchema", () => {
  it("applies default retry and rateLimit values when omitted", () => {
    const config = ConfigSchema.parse({
      outlookClientId: "cid",
      outlookClientSecret: "secret",
      outlookTenantId: "tenant",
      outlookUserId: "user",
      resendApiKey: "key",
      resendSender: "from@example.com",
    });

    expect(config.rateLimit).toEqual({
      windowMs: 60 * 60 * 1000,
      maxAttempts: 5,
    });
    expect(config.retry).toEqual({
      maxAttempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 5000,
    });
  });

  it("allows overriding retry and rateLimit settings", () => {
    const config = ConfigSchema.parse({
      outlookClientId: "cid",
      outlookClientSecret: "secret",
      outlookTenantId: "tenant",
      outlookUserId: "user",
      resendApiKey: "key",
      resendSender: "from@example.com",
      rateLimit: { windowMs: 45_000, maxAttempts: 2 },
      retry: { maxAttempts: 1, baseDelayMs: 100, maxDelayMs: 1000 },
    });

    expect(config.rateLimit).toEqual({ windowMs: 45_000, maxAttempts: 2 });
    expect(config.retry).toEqual({
      maxAttempts: 1,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    });
  });
});
