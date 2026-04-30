import { describe, expect, it } from "vitest";
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./unsubscribe-token.js";

const SECRET = "test-secret-key-123";
const OTHER_SECRET = "different-secret-456";

describe("createUnsubscribeToken", () => {
  it("produces a two-part token separated by a dot", () => {
    const token = createUnsubscribeToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "AAPL",
      secret: SECRET,
    });
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0]).not.toBe("");
    expect(parts[1]).not.toBe("");
    expect(token).not.toContain("+"); // base64url, no padding
  });
});

describe("verifyUnsubscribeToken", () => {
  it("round-trips: verify returns decoded fields after create", () => {
    const userTickerId = "550e8400-e29b-41d4-a716-446655440000";
    const tickerSymbol = "AAPL";
    const token = createUnsubscribeToken({
      userTickerId,
      tickerSymbol,
      secret: SECRET,
    });

    const result = verifyUnsubscribeToken(token, SECRET);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.userTickerId).toBe(userTickerId);
      expect(result.tickerSymbol).toBe(tickerSymbol);
    }
  });

  it("rejects a tampered payload", () => {
    const token = createUnsubscribeToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "AAPL",
      secret: SECRET,
    });
    const [payload, sig] = token.split(".");
    // Flip one character in the payload
    const tampered = `${payload}X.${sig}`;
    const result = verifyUnsubscribeToken(tampered, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("rejects a tampered signature", () => {
    const token = createUnsubscribeToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "AAPL",
      secret: SECRET,
    });
    const [payload, sig] = token.split(".");
    const tampered = `${payload}.${sig}X`;
    const result = verifyUnsubscribeToken(tampered, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("rejects an expired token", () => {
    const token = createUnsubscribeToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "AAPL",
      secret: SECRET,
      expiresInMs: -1, // already expired
    });
    const result = verifyUnsubscribeToken(token, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("expired");
    }
  });

  it("rejects a token signed with a different secret", () => {
    const token = createUnsubscribeToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "AAPL",
      secret: SECRET,
    });
    const result = verifyUnsubscribeToken(token, OTHER_SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("accepts a token with very short expiry immediately after creation", () => {
    const token = createUnsubscribeToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "AAPL",
      secret: SECRET,
      expiresInMs: 5000, // 5 seconds
    });
    const result = verifyUnsubscribeToken(token, SECRET);
    expect(result.valid).toBe(true);
  });

  it("rejects a completely malformed token", () => {
    const result = verifyUnsubscribeToken("not-a-token-at-all", SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("rejects an empty string token", () => {
    const result = verifyUnsubscribeToken("", SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid");
    }
  });
});
