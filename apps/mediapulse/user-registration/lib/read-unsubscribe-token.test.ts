/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createUnsubscribeToken } from "@workspace/utils";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api.internal",
    UNSUBSCRIBE_SECRET: "test-secret",
    NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@example.com",
  },
}));

import { readUnsubscribeToken } from "./read-unsubscribe-token";

const SECRET = "unit-test-secret";

describe("readUnsubscribeToken", () => {
  it("returns the ticker symbol for a valid token", () => {
    const token = createUnsubscribeToken({
      userTickerId: "11111111-1111-4111-a111-111111111111",
      tickerSymbol: "BBCA",
      secret: SECRET,
    });

    expect(readUnsubscribeToken(token, SECRET)).toEqual({
      valid: true,
      tickerSymbol: "BBCA",
    });
  });

  it("returns expired for a token past its lifetime", () => {
    const token = createUnsubscribeToken({
      userTickerId: "11111111-1111-4111-a111-111111111111",
      tickerSymbol: "BBCA",
      secret: SECRET,
      expiresInMs: -1000,
    });

    expect(readUnsubscribeToken(token, SECRET)).toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("returns invalid for a tampered token", () => {
    const token = createUnsubscribeToken({
      userTickerId: "11111111-1111-4111-a111-111111111111",
      tickerSymbol: "BBCA",
      secret: SECRET,
    });

    expect(readUnsubscribeToken(`${token}tampered`, SECRET)).toEqual({
      valid: false,
      reason: "invalid",
    });
  });

  it("returns invalid for an empty token without checking the signature", () => {
    expect(readUnsubscribeToken("", SECRET)).toEqual({
      valid: false,
      reason: "invalid",
    });
  });
});
