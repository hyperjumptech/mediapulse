/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { scoreSourceQuality } from "./source-quality";

describe("scoreSourceQuality", () => {
  it("returns trusted domain score for exact host", () => {
    // Setup
    const trustedDomains = {
      "reuters.com": 0.9,
    };

    // Act
    const score = scoreSourceQuality({
      articleUrl: "https://reuters.com/world/markets",
      trustedDomains,
    });

    // Assert
    expect(score).toBe(0.9);
  });

  it("matches trusted domain after removing www prefix", () => {
    // Setup
    const trustedDomains = {
      "bisnis.com": 0.85,
    };

    // Act
    const score = scoreSourceQuality({
      articleUrl: "https://www.bisnis.com/article",
      trustedDomains,
    });

    // Assert
    expect(score).toBe(0.85);
  });

  it("returns fallback for invalid or unknown domains", () => {
    // Setup
    const trustedDomains = {
      "kontan.co.id": 0.85,
    };

    // Act
    const invalidScore = scoreSourceQuality({
      articleUrl: "not-a-url",
      trustedDomains,
    });
    const unknownScore = scoreSourceQuality({
      articleUrl: "https://example.org/news",
      trustedDomains,
    });

    // Assert
    expect(invalidScore).toBe(0.5);
    expect(unknownScore).toBe(0.5);
  });
});
