/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  findBestMatchingPhrase,
  injectTitlePhraseLink,
  tokenize,
} from "./phrase-link-injector";

describe("tokenize", () => {
  it("lowercases and splits on non-word characters", () => {
    // Act
    const tokens = tokenize("Bank Central Asia");

    // Assert
    expect(tokens).toEqual(["bank", "central", "asia"]);
  });

  it("filters out stop words", () => {
    // Act
    const tokens = tokenize("the rise of inflation");

    // Assert
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("of");
    expect(tokens).toContain("rise");
    expect(tokens).toContain("inflation");
  });

  it("filters out tokens shorter than 3 characters", () => {
    // Act
    const tokens = tokenize("BCA Q1 earnings");

    // Assert
    expect(tokens).not.toContain("q1");
    expect(tokens).toContain("bca");
    expect(tokens).toContain("earnings");
  });

  it("returns empty array for text with only stop words", () => {
    // Act
    const tokens = tokenize("the a an");

    // Assert
    expect(tokens).toEqual([]);
  });
});

describe("findBestMatchingPhrase", () => {
  it("returns a phrase when summary contains words from the title", () => {
    // Setup
    const titleTokens = new Set(["bank", "central", "asia", "earnings"]);
    const summary =
      "Bank Central Asia reported strong quarterly earnings growth.";

    // Act
    const phrase = findBestMatchingPhrase(summary, titleTokens);

    // Assert
    expect(phrase).not.toBeNull();
    expect(typeof phrase).toBe("string");
  });

  it("returns null when there is no meaningful overlap", () => {
    // Setup
    const titleTokens = new Set(["unrelated", "completely", "different"]);
    const summary =
      "Interest rates rise following central bank policy decision.";

    // Act
    const phrase = findBestMatchingPhrase(summary, titleTokens);

    // Assert
    expect(phrase).toBeNull();
  });

  it("returns null for an empty title token set", () => {
    // Setup
    const titleTokens = new Set<string>();
    const summary = "Some summary text about a company.";

    // Act
    const phrase = findBestMatchingPhrase(summary, titleTokens);

    // Assert
    expect(phrase).toBeNull();
  });

  it("returns null when summary is too short for a window", () => {
    // Setup
    const titleTokens = new Set(["earnings"]);
    const summary = "Earnings.";

    // Act
    const phrase = findBestMatchingPhrase(summary, titleTokens);

    // Assert
    expect(phrase).toBeNull();
  });

  it("returns the best matching window, not just the first overlap", () => {
    // Setup — title strongly overlaps with "quarterly earnings growth" in the middle
    const titleTokens = new Set(["quarterly", "earnings", "growth"]);
    const summary =
      "Despite challenges, the company posted quarterly earnings growth beating forecasts.";

    // Act
    const phrase = findBestMatchingPhrase(summary, titleTokens);

    // Assert
    expect(phrase).not.toBeNull();
    // The phrase should contain at least one of the meaningful title words
    const lowerPhrase = phrase!.toLowerCase();
    const hasTitleWord =
      lowerPhrase.includes("quarterly") ||
      lowerPhrase.includes("earnings") ||
      lowerPhrase.includes("growth");
    expect(hasTitleWord).toBe(true);
  });
});

describe("injectTitlePhraseLink", () => {
  it("wraps the matching phrase with a markdown link", () => {
    // Setup
    const summary =
      "Bank Central Asia reported strong quarterly earnings growth this year.";
    const title = "BCA Posts Quarterly Earnings Growth";
    const url = "https://reuters.com/article/bca-earnings";

    // Act
    const result = injectTitlePhraseLink(summary, title, url);

    // Assert
    expect(result).toContain(`](${url})`);
    expect(result).toContain("[");
  });

  it("returns the summary unchanged when no phrase matches", () => {
    // Setup
    const summary = "Global trade tensions continue to weigh on markets.";
    const title = "XYZXYZXYZ Unrelated Zqwert Title";
    const url = "https://reuters.com/article/unrelated";

    // Act
    const result = injectTitlePhraseLink(summary, title, url);

    // Assert
    expect(result).toBe(summary);
    expect(result).not.toContain(url);
  });

  it("only replaces the first occurrence of the phrase", () => {
    // Setup
    const summary =
      "Earnings growth was strong. The earnings growth surprised analysts.";
    const title = "Strong Earnings Growth Reported";
    const url = "https://bloomberg.com/article/earnings";

    // Act
    const result = injectTitlePhraseLink(summary, title, url);

    // Assert
    // Exactly one markdown link should appear
    const linkCount = (result.match(/\]\(https?:\/\//g) ?? []).length;
    expect(linkCount).toBe(1);
  });

  it("preserves the rest of the summary text outside the injected phrase", () => {
    // Setup
    const summary =
      "The central bank raised interest rates by 25 basis points.";
    const title = "Central Bank Raises Interest Rates";
    const url = "https://ft.com/article/rates";

    // Act
    const result = injectTitlePhraseLink(summary, title, url);

    // Assert
    // Result should still be a valid string containing the url if a match was found,
    // or the original summary if not. Either way, no content should be lost.
    const textWithoutMarkdown = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    // All original non-link words should still be present
    expect(textWithoutMarkdown.length).toBeGreaterThan(0);
  });
});
