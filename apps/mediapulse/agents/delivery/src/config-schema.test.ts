import { describe, expect, it } from "vitest";

import { DeliveryConfigSchema } from "./config-schema.js";

const minimalResendConfig = {
  resendApiKey: "re_test_key",
  resend: { from: "sender@example.com" },
} as const;

describe("DeliveryConfigSchema", () => {
  it("rejects when both send body parts are disabled", () => {
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      send: { includeHtml: false, includeText: false },
    });
    expect(r.success).toBe(false);
  });

  it("accepts default send (html + text) when resend fields are set", () => {
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      unsubscribe: { secret: "secret", baseUrl: "https://example.com/api" },
    });
    expect(r.success).toBe(true);
    expect(r.data?.send.includeHtml).toBe(true);
    expect(r.data?.send.includeText).toBe(true);
  });

  it("rejects when resendApiKey is missing", () => {
    const r = DeliveryConfigSchema.safeParse({
      resend: { from: "a@b.com" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects when resend.from is missing", () => {
    const r = DeliveryConfigSchema.safeParse({
      resendApiKey: "re_x",
      resend: {},
    });
    expect(r.success).toBe(false);
  });

  it("accepts optional unsubscribe config with secret and baseUrl", () => {
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      unsubscribe: {
        secret: "my-hmac-secret",
        baseUrl: "https://app.example.com/api",
      },
    });
    expect(r.success).toBe(true);
    expect(r.data?.unsubscribe.secret).toBe("my-hmac-secret");
    expect(r.data?.unsubscribe.baseUrl).toBe("https://app.example.com/api");
  });

  it("rejects invalid unsubscribe.baseUrl", () => {
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      unsubscribe: {
        secret: "secret",
        baseUrl: "not-a-url",
      },
    });
    expect(r.success).toBe(false);
  });
});
