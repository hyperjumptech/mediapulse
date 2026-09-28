/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  DASHBOARD_SESSION_MAX_AGE_SECONDS,
  signDashboardSession,
  verifyDashboardSession,
} from "./dashboard-session-token";

const claims = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  credentialVersion: 2,
};

const issuedAt = Date.UTC(2026, 8, 28, 0, 0, 0);

describe("signDashboardSession / verifyDashboardSession", () => {
  it("round-trips the claims with an expiry", () => {
    // Setup
    const keys = { current: "current-key" };

    // Act
    const token = signDashboardSession(claims, { now: issuedAt, keys });
    const verified = verifyDashboardSession(token, { now: issuedAt, keys });

    // Assert
    expect(verified).toEqual({
      ...claims,
      exp: issuedAt / 1000 + DASHBOARD_SESSION_MAX_AGE_SECONDS,
    });
  });

  it("rejects a token whose payload was altered", () => {
    // Setup
    const keys = { current: "current-key" };
    const token = signDashboardSession(claims, { now: issuedAt, keys });
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...claims, id: "someone-else", exp: 9_999_999_999 }),
    ).toString("base64url");

    // Act
    const verified = verifyDashboardSession(`${forgedPayload}.${signature}`, {
      now: issuedAt,
      keys,
    });

    // Assert
    expect(verified).toBeNull();
  });

  it("rejects a token signed with another key", () => {
    // Setup
    const token = signDashboardSession(claims, {
      now: issuedAt,
      keys: { current: "attacker-key" },
    });

    // Act
    const verified = verifyDashboardSession(token, {
      now: issuedAt,
      keys: { current: "current-key" },
    });

    // Assert
    expect(verified).toBeNull();
  });

  it("accepts a token signed with the previous key during rotation", () => {
    // Setup
    const token = signDashboardSession(claims, {
      now: issuedAt,
      keys: { current: "old-key" },
    });

    // Act
    const verified = verifyDashboardSession(token, {
      now: issuedAt,
      keys: { current: "new-key", previous: "old-key" },
    });

    // Assert
    expect(verified).toMatchObject(claims);
  });

  it("rejects an expired token", () => {
    // Setup
    const keys = { current: "current-key" };
    const token = signDashboardSession(claims, { now: issuedAt, keys });
    const afterExpiry =
      issuedAt + (DASHBOARD_SESSION_MAX_AGE_SECONDS + 1) * 1000;

    // Act
    const verified = verifyDashboardSession(token, { now: afterExpiry, keys });

    // Assert
    expect(verified).toBeNull();
  });

  it.each([
    ["legacy unsigned JSON", JSON.stringify(claims)],
    ["empty string", ""],
    ["missing signature", "abc."],
    ["extra separators", "a.b.c"],
    ["signature only", ".abc"],
  ])("rejects %s", (_label, token) => {
    // Act
    const verified = verifyDashboardSession(token, {
      now: issuedAt,
      keys: { current: "current-key" },
    });

    // Assert
    expect(verified).toBeNull();
  });

  it("uses HERMES_INTERNAL_API_KEY by default", () => {
    // Act
    const token = signDashboardSession(claims);

    // Assert
    expect(verifyDashboardSession(token)).toMatchObject(claims);
  });
});
