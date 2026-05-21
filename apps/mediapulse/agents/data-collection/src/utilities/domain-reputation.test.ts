/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  domainTier,
  extractHostname,
  reputationScore,
} from "./domain-reputation";

describe("extractHostname", () => {
  it("returns the lowercase hostname from a URL", () => {
    // Act
    const hostname = extractHostname("https://WWW.Reuters.com/markets/foo");

    // Assert
    expect(hostname).toBe("www.reuters.com");
  });
});

describe("reputationScore", () => {
  it("returns tier scores for known hosts", () => {
    // Assert
    expect(reputationScore("www.reuters.com")).toBe(3);
    expect(reputationScore("www.marketwatch.com")).toBe(2);
    expect(reputationScore("www.medium.com")).toBe(1);
    expect(reputationScore("unknown.example")).toBe(0);
  });
});

describe("domainTier", () => {
  it("classifies tier-1 editorial hosts", () => {
    // Assert
    expect(domainTier("www.kompas.com")).toBe("tier_1");
  });
});
