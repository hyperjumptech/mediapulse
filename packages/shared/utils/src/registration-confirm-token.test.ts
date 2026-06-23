import { describe, expect, it } from "vitest";
import {
  createRegistrationConfirmToken,
  verifyRegistrationConfirmToken,
} from "./registration-confirm-token.js";

const SECRET = "test-registration-confirm-secret";
const OTHER_SECRET = "different-secret-456";

describe("createRegistrationConfirmToken", () => {
  it("produces a two-part token separated by a dot", () => {
    const token = createRegistrationConfirmToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "BBCA",
      secret: SECRET,
    });
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0]).not.toBe("");
    expect(parts[1]).not.toBe("");
  });
});

describe("verifyRegistrationConfirmToken", () => {
  it("round-trips: verify returns decoded fields after create", () => {
    const userTickerId = "550e8400-e29b-41d4-a716-446655440000";
    const tickerSymbol = "BBCA";
    const token = createRegistrationConfirmToken({
      userTickerId,
      tickerSymbol,
      secret: SECRET,
    });

    const result = verifyRegistrationConfirmToken(token, SECRET);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.userTickerId).toBe(userTickerId);
      expect(result.tickerSymbol).toBe(tickerSymbol);
    }
  });

  it("rejects a tampered payload", () => {
    const token = createRegistrationConfirmToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "BBCA",
      secret: SECRET,
    });
    const [payload, sig] = token.split(".");
    const tampered = `${payload}X.${sig}`;
    const result = verifyRegistrationConfirmToken(tampered, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("rejects a tampered signature", () => {
    const token = createRegistrationConfirmToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "BBCA",
      secret: SECRET,
    });
    const [payload, sig] = token.split(".");
    const tampered = `${payload}.${sig}X`;
    const result = verifyRegistrationConfirmToken(tampered, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("rejects an expired token", () => {
    const token = createRegistrationConfirmToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "BBCA",
      secret: SECRET,
      expiresInMs: -1,
    });
    const result = verifyRegistrationConfirmToken(token, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("expired");
    }
  });

  it("rejects a token signed with a different secret", () => {
    const token = createRegistrationConfirmToken({
      userTickerId: "550e8400-e29b-41d4-a716-446655440000",
      tickerSymbol: "BBCA",
      secret: SECRET,
    });
    const result = verifyRegistrationConfirmToken(token, OTHER_SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("rejects malformed tokens", () => {
    expect(verifyRegistrationConfirmToken("", SECRET).valid).toBe(false);
    expect(verifyRegistrationConfirmToken("not-a-token", SECRET).valid).toBe(
      false,
    );
  });
});
