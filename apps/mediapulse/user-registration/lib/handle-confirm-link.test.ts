/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://localhost:8081",
    REGISTRATION_CONFIRM_SECRET: "test-secret",
    USER_REGISTRATION_RESEND_API_KEY: "test-key",
    USER_REGISTRATION_RESEND_FROM: "MediaPulse <test@example.com>",
    USER_REGISTRATION_PUBLIC_URL: "http://localhost:3002",
    NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@test.example",
  },
}));

import { handleConfirmLink, toConfirmBrowserHtml } from "./handle-confirm-link";

describe("toConfirmBrowserHtml", () => {
  it("renders a confirmed message", async () => {
    const response = toConfirmBrowserHtml({
      status: "confirmed",
      displaySymbol: "BBCA",
    });
    const html = await response.text();
    expect(html).toContain("Subscription confirmed");
    expect(html).toContain("BBCA");
  });
});

describe("handleConfirmLink", () => {
  it("sends welcome email when newly confirmed", async () => {
    const requestConfirmSubscription = vi.fn().mockResolvedValue({
      status: "confirmed",
      displaySymbol: "BBCA",
      email: "alice@example.com",
    });
    const sendRegistrationConfirmedEmail = vi.fn().mockResolvedValue(undefined);

    const response = await handleConfirmLink("token-123", {
      requestConfirmSubscription,
      sendRegistrationConfirmedEmail,
    });

    expect(requestConfirmSubscription).toHaveBeenCalledWith("token-123");
    expect(sendRegistrationConfirmedEmail).toHaveBeenCalledWith({
      to: "alice@example.com",
      tickerSymbol: "BBCA",
    });
    expect(await response.text()).toContain("Subscription confirmed");
  });

  it("returns invalid HTML for empty tokens", async () => {
    const response = await handleConfirmLink("");
    expect(await response.text()).toMatch(/invalid/i);
  });
});
