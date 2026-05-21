/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  aliasMatchesHaystack,
  buildTickerAliases,
  isRelevant,
} from "./ticker-relevance-gate";

/** Builds article-like body text with at least 80 unique words. */
const longBody = (middle: string): string =>
  [
    middle,
    ...Array.from(
      { length: 90 },
      (_, index) =>
        `Analyst note ${index} discusses lending trends and deposit growth in Indonesia.`,
    ),
  ].join(" ");

describe("buildTickerAliases", () => {
  it("deduplicates symbol, name, and known aliases", () => {
    // Act
    const aliases = buildTickerAliases("BBCA", "Bank Central Asia", [
      "BBCA",
      "BCA",
    ]);

    // Assert
    expect(aliases).toEqual(["bbca", "bank central asia", "bca"]);
  });
});

describe("aliasMatchesHaystack", () => {
  it("matches BBRI inside exchange suffix tokens", () => {
    // Act
    const matched = aliasMatchesHaystack(
      "pt bbri.jk reported earnings",
      "bbri",
    );

    // Assert
    expect(matched).toBe(true);
  });

  it("does not match BBRI inside unrelated words", () => {
    // Act
    const matched = aliasMatchesHaystack(
      "this is an abbreviation only",
      "bbri",
    );

    // Assert
    expect(matched).toBe(false);
  });
});

describe("isRelevant", () => {
  it("matches a page whose body mentions a company alias", () => {
    // Act
    const decision = isRelevant({
      title: "Market update headline here",
      content: longBody(
        "Apple announced new product plans for the year ahead.",
      ),
      aliases: ["aapl", "apple"],
    });

    // Assert
    expect(decision).toEqual({ relevant: true });
  });

  it("rejects a page that only mentions an unrelated company", () => {
    // Act
    const decision = isRelevant({
      title: "Market update headline here",
      content: longBody("Microsoft Q2 earnings beat analyst expectations."),
      aliases: ["aapl", "apple"],
    });

    // Assert
    expect(decision).toEqual({
      relevant: false,
      reason: "no_alias_match",
    });
  });

  it("honors headChars when scanning for aliases", () => {
    // Setup
    const padding = "x".repeat(2000);
    const content = `${padding} Apple announced new product plans. ${longBody("")}`;

    // Act
    const decision = isRelevant(
      {
        title: "Market update headline here",
        content,
        aliases: ["aapl", "apple"],
      },
      { headChars: 1500 },
    );

    // Assert
    expect(decision).toEqual({
      relevant: false,
      reason: "no_alias_match",
    });
  });

  it("does not treat AAPL as matching snapple", () => {
    // Act
    const decision = isRelevant({
      title: "Beverage industry headline",
      content: longBody("Snapple released a new flavor for summer."),
      aliases: ["aapl"],
    });

    // Assert
    expect(decision).toEqual({
      relevant: false,
      reason: "no_alias_match",
    });
  });

  it("matches BBRI in PT BBRI and BBRI.JK but not abbreviation", () => {
    // Act
    const ptDecision = isRelevant({
      title: "Regional banks headline",
      content: longBody("PT BBRI reported stronger loan growth this quarter."),
      aliases: ["bbri"],
    });
    const suffixDecision = isRelevant({
      title: "IDX market headline",
      content: longBody("Shares of BBRI.JK rose after the earnings release."),
      aliases: ["bbri"],
    });
    const unrelatedDecision = isRelevant({
      title: "Language headline",
      content: longBody("This paragraph only uses the word abbreviation."),
      aliases: ["bbri"],
    });

    // Assert
    expect(ptDecision).toEqual({ relevant: true });
    expect(suffixDecision).toEqual({ relevant: true });
    expect(unrelatedDecision).toEqual({
      relevant: false,
      reason: "no_alias_match",
    });
  });

  it("is a no-op when the alias list is empty", () => {
    // Act
    const decision = isRelevant({
      title: "Any headline",
      content: "Any content without ticker mentions.",
      aliases: [],
    });

    // Assert
    expect(decision).toEqual({ relevant: true });
  });
});
