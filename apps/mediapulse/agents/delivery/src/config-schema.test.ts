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
    const r = DeliveryConfigSchema.safeParse(minimalResendConfig);
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

  it("accepts optional template.preferencesUrl when valid absolute URL", () => {
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      template: {
        newsletterVariant: "default" as const,
        preferencesUrl: "https://example.com/prefs",
      },
    });
    expect(r.success).toBe(true);
    expect(r.data?.template.preferencesUrl).toBe("https://example.com/prefs");
  });

  it("rejects invalid template.preferencesUrl", () => {
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      template: {
        newsletterVariant: "default" as const,
        preferencesUrl: "not-a-url",
      },
    });
    expect(r.success).toBe(false);
  });
});
