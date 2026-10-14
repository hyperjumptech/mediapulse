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

  it("keeps accepting a template that names only the newsletter variant", () => {
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      template: { newsletterVariant: "default" },
    });
    expect(r.success).toBe(true);
    expect(r.data?.template).toEqual({ newsletterVariant: "default" });
  });

  it("accepts a review time label per language", () => {
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      template: {
        newsletterVariant: "default",
        reviewTimeLabels: { en: "7:00 AM WIB", id: " 07.00 WIB " },
      },
    });
    expect(r.success).toBe(true);
    expect(r.data?.template.reviewTimeLabels).toEqual({
      en: "7:00 AM WIB",
      id: "07.00 WIB",
    });
  });

  it("rejects a blank review time label", () => {
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      template: { reviewTimeLabels: { en: "  " } },
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
});
