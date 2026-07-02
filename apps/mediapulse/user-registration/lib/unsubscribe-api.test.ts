/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api.internal/",
    NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@example.com",
  },
}));

import { requestUnsubscribe } from "./unsubscribe-api";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("requestUnsubscribe", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shapes a GET request for the link method and trims a trailing slash", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ status: "unsubscribed", displaySymbol: "BBCA" }),
      );

    const result = await requestUnsubscribe("abc def", "link", fetchImpl);

    expect(result).toEqual({ status: "unsubscribed", displaySymbol: "BBCA" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://agent-data-api.internal/api/v1/user-registration-unsubscribe?token=abc%20def",
      { method: "GET", cache: "no-store" },
    );
  });

  it("shapes a POST request for the one_click method", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ status: "unsubscribed" }));

    await requestUnsubscribe("token-123", "one_click", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://agent-data-api.internal/api/v1/user-registration-unsubscribe",
      {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "token-123" }),
      },
    );
  });

  it("throws when the upstream response is not ok", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({}, 500));

    await expect(
      requestUnsubscribe("token", "link", fetchImpl),
    ).rejects.toThrow(/status 500/);
  });
});
