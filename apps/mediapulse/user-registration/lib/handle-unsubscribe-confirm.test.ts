/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api.internal",
    UNSUBSCRIBE_SECRET: "test-secret",
    NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@example.com",
  },
}));

import { handleUnsubscribeConfirm } from "./handle-unsubscribe-confirm";
import { resetMemorySlidingRateLimitForTests } from "./memory-sliding-rate-limit";

describe("handleUnsubscribeConfirm", () => {
  afterEach(() => {
    resetMemorySlidingRateLimitForTests();
    vi.restoreAllMocks();
  });

  it("performs a link-method unsubscribe and returns the outcome", async () => {
    const requestUnsubscribe = vi
      .fn()
      .mockResolvedValue({ status: "unsubscribed", displaySymbol: "BBCA" });

    const result = await handleUnsubscribeConfirm(
      { token: "token-123" },
      new Request("http://localhost"),
      { requestUnsubscribe },
    );

    expect(result).toEqual({ status: "unsubscribed", displaySymbol: "BBCA" });
    expect(requestUnsubscribe).toHaveBeenCalledWith("token-123", "link");
  });

  it("passes through the already_unsubscribed status", async () => {
    const requestUnsubscribe = vi.fn().mockResolvedValue({
      status: "already_unsubscribed",
      displaySymbol: "BBCA",
    });

    const result = await handleUnsubscribeConfirm(
      { token: "token-123" },
      new Request("http://localhost"),
      { requestUnsubscribe },
    );

    expect(result.status).toBe("already_unsubscribed");
  });

  it("returns invalid without calling the API when rate limited", async () => {
    const requestUnsubscribe = vi.fn();
    const checkRateLimit = vi.fn().mockReturnValue(false);

    const result = await handleUnsubscribeConfirm(
      { token: "token-123" },
      new Request("http://localhost"),
      { requestUnsubscribe, checkRateLimit },
    );

    expect(result).toEqual({ status: "invalid" });
    expect(requestUnsubscribe).not.toHaveBeenCalled();
  });
});
