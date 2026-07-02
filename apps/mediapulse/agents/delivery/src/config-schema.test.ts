import {
  DEFAULT_HYPERJUMP_SITE_URL,
  DEFAULT_MEDIAPULSE_SITE_URL,
} from "@workspace/email-templates";
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

  it("rejects when resend.from is missing", () => {
    const r = DeliveryConfigSchema.safeParse({
      resendApiKey: "re_x",
      resend: {},
    });
    expect(r.success).toBe(false);
  });

  it("fills branding URLs with public defaults when the key is omitted", () => {
    // Act
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
    });

    // Assert
    expect(r.success).toBe(true);
    expect(r.data?.branding.mediapulseSiteUrl).toBe(
      DEFAULT_MEDIAPULSE_SITE_URL,
    );
    expect(r.data?.branding.hyperjumpSiteUrl).toBe(DEFAULT_HYPERJUMP_SITE_URL);
  });

  it("fills missing individual branding URLs with defaults", () => {
    // Setup
    const customMediapulse = "https://staging.mediapulse.example";

    // Act
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      branding: { mediapulseSiteUrl: customMediapulse },
    });

    // Assert
    expect(r.success).toBe(true);
    expect(r.data?.branding.mediapulseSiteUrl).toBe(customMediapulse);
    expect(r.data?.branding.hyperjumpSiteUrl).toBe(DEFAULT_HYPERJUMP_SITE_URL);
  });

  it("accepts operator-supplied https branding URLs", () => {
    // Setup
    const mediapulseSiteUrl = "https://staging.mediapulse.example";
    const hyperjumpSiteUrl = "https://staging.hyperjump.example";

    // Act
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      branding: { mediapulseSiteUrl, hyperjumpSiteUrl },
    });

    // Assert
    expect(r.success).toBe(true);
    expect(r.data?.branding.mediapulseSiteUrl).toBe(mediapulseSiteUrl);
    expect(r.data?.branding.hyperjumpSiteUrl).toBe(hyperjumpSiteUrl);
  });

  it("rejects http (non-https) branding URLs", () => {
    // Act
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      branding: { mediapulseSiteUrl: "http://insecure.example" },
    });

    // Assert
    expect(r.success).toBe(false);
  });

  it("rejects malformed branding URLs", () => {
    // Act
    const r = DeliveryConfigSchema.safeParse({
      ...minimalResendConfig,
      branding: { hyperjumpSiteUrl: "not-a-url" },
    });

    // Assert
    expect(r.success).toBe(false);
  });
});
