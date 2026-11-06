/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

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

import {
  handleConfirmRequest,
  getClientIpFromRequest,
} from "./handle-confirm-request";
import { resetMemorySlidingRateLimitForTests } from "./memory-sliding-rate-limit";

describe("getClientIpFromRequest", () => {
  it("reads the first x-forwarded-for address", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });

    expect(getClientIpFromRequest(request)).toBe("1.2.3.4");
  });
});

describe("handleConfirmRequest", () => {
  afterEach(() => {
    resetMemorySlidingRateLimitForTests();
    vi.restoreAllMocks();
  });

  it("returns ok and sends pending email for new subscriptions", async () => {
    const requestWebSignup = vi.fn().mockResolvedValue({
      tickerKnown: true,
      userTickerId: "11111111-1111-4111-a111-111111111111",
      isNewSubscription: true,
    });
    const sendPendingConfirmationEmail = vi.fn().mockResolvedValue(undefined);

    const result = await handleConfirmRequest(
      {
        email: "alice@example.com",
        name: "Alice",
        tickerSymbol: "BBCA",
        language: "en",
      },
      new Request("http://localhost"),
      { requestWebSignup, sendPendingConfirmationEmail },
    );

    expect(result).toEqual({ ok: true });
    expect(sendPendingConfirmationEmail).toHaveBeenCalledWith({
      to: "alice@example.com",
      name: "Alice",
      tickerSymbol: "BBCA",
      userTickerId: "11111111-1111-4111-a111-111111111111",
    });
  });

  it("returns ok without sending when subscription is already confirmed", async () => {
    const requestWebSignup = vi.fn().mockResolvedValue({
      tickerKnown: true,
      userTickerId: "11111111-1111-4111-a111-111111111111",
      isNewSubscription: false,
    });
    const sendPendingConfirmationEmail = vi.fn();

    const result = await handleConfirmRequest(
      {
        email: "alice@example.com",
        name: "Alice",
        tickerSymbol: "BBCA",
        language: "en",
      },
      new Request("http://localhost"),
      { requestWebSignup, sendPendingConfirmationEmail },
    );

    expect(result).toEqual({ ok: true });
    expect(sendPendingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("returns ok and logs the failure when the confirmation email is rejected", async () => {
    const requestWebSignup = vi.fn().mockResolvedValue({
      tickerKnown: true,
      userTickerId: "11111111-1111-4111-a111-111111111111",
      isNewSubscription: true,
    });
    const sendFailure = new Error(
      "Resend email send failed: The example.com domain is not verified.",
    );
    const sendPendingConfirmationEmail = vi.fn().mockRejectedValue(sendFailure);
    const log = { info: vi.fn(), error: vi.fn() };

    const result = await handleConfirmRequest(
      {
        email: "alice@example.com",
        name: "Alice",
        tickerSymbol: "BBCA",
        language: "en",
      },
      new Request("http://localhost"),
      { requestWebSignup, sendPendingConfirmationEmail, log },
    );

    expect(result).toEqual({ ok: true });
    expect(log.error).toHaveBeenCalledWith(
      { err: sendFailure, tickerSymbol: "BBCA" },
      "user-registration: confirm request failed, no email sent",
    );
  });

  it("logs why no email was sent when the request is rate limited", async () => {
    const requestWebSignup = vi.fn();
    const sendPendingConfirmationEmail = vi.fn();
    const checkRateLimit = vi.fn().mockReturnValue(false);
    const log = { info: vi.fn(), error: vi.fn() };

    const result = await handleConfirmRequest(
      {
        email: "alice@example.com",
        name: "Alice",
        tickerSymbol: "BBCA",
        language: "en",
      },
      new Request("http://localhost"),
      { requestWebSignup, sendPendingConfirmationEmail, checkRateLimit, log },
    );

    expect(result).toEqual({ ok: true });
    expect(requestWebSignup).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(
      { tickerSymbol: "BBCA", ipAllowed: false, emailAllowed: false },
      "user-registration: confirm request rate limited, no email sent",
    );
  });
});
