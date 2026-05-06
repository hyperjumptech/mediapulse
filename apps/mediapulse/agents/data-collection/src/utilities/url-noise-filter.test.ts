/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { canonicalizeUrl, classifyNoisyUrl } from "./url-noise-filter";

describe("canonicalizeUrl", () => {
  it("strips hashes and tracking params while preserving non-tracking params", () => {
    // Act
    const canonical = canonicalizeUrl(
      "https://Finance.Yahoo.com/quote/BBCA.JK/?utm_source=x&region=ID#fragment",
    );

    // Assert
    expect(canonical).toBe("https://finance.yahoo.com/quote/BBCA.JK?region=ID");
  });
});

describe("classifyNoisyUrl", () => {
  it("blocks quote/profile style URLs from the CSV patterns", () => {
    // Act
    const decision = classifyNoisyUrl(
      "https://finance.yahoo.com/quote/BBCA.JK/",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "blocked_host_path",
      canonicalUrl: "https://finance.yahoo.com/quote/BBCA.JK",
    });
  });

  it("blocks social URLs from the CSV patterns", () => {
    // Act
    const decision = classifyNoisyUrl(
      "https://www.linkedin.com/posts/example_company-update",
    );

    // Assert
    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("blocked_host");
    }
  });

  it("allows Reuters article URLs while still allowing canonicalization", () => {
    // Act
    const decision = classifyNoisyUrl(
      "https://www.reuters.com/world/asia-pacific/sample-story-2026-01-01/",
    );

    // Assert
    expect(decision).toEqual({
      blocked: false,
      canonicalUrl:
        "https://www.reuters.com/world/asia-pacific/sample-story-2026-01-01",
    });
  });

  it("blocks Reuters company/market page URLs", () => {
    // Act
    const decision = classifyNoisyUrl(
      "https://www.reuters.com/markets/companies/BBCA.JK/",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "blocked_host_path",
      canonicalUrl: "https://www.reuters.com/markets/companies/BBCA.JK",
    });
  });
});
