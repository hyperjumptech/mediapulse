/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  classifyNonArticleSource,
  countRepeatedShingles,
  createEmptyQualityCounters,
  runArticleQualityGate,
} from "./content-quality-gate.js";

/** Builds article-like body text with at least 120 unique words. */
const cleanArticleBody = (): string =>
  [
    "Bank Central Asia announced strategic expansion plans across regional markets.",
    "The company reported improved margins, higher loan growth, and stronger risk controls.",
    ...Array.from(
      { length: 130 },
      (_, index) =>
        `Analyst note ${index} discusses lending trends and deposit growth in Indonesia.`,
    ),
  ].join(" ");

/** Builds paywall stub text with low alphabetic density. */
const paywallBody = (): string =>
  "!!! $$$ ### subscribe to read !!! $$$ ### ".repeat(25);

/** Builds soft-404 stub text under the length threshold. */
const soft404Body = (): string => `Sorry, page not found. ${"x".repeat(200)}`;

/** Builds body text below the minimum word count. */
const shortBody = (): string => "word ".repeat(50);

/** Builds nav-heavy body where one six-word shingle exceeds 18% of shingles. */
const repetitiveBody = (): string => "home about contact ".repeat(300);

describe("createEmptyQualityCounters", () => {
  it("returns zeroed counters for every drop reason", () => {
    // Act
    const counters = createEmptyQualityCounters();

    // Assert
    expect(counters).toEqual({
      prefilter_blocked_host: 0,
      prefilter_blocked_path: 0,
      prefilter_index_title: 0,
      content_no_title: 0,
      content_soft_404: 0,
      content_access_gated: 0,
      content_too_short: 0,
      content_repetitive: 0,
    });
  });
});

describe("countRepeatedShingles", () => {
  it("returns zero when content has fewer words than the shingle width", () => {
    // Act
    const fraction = countRepeatedShingles("one two three", 6);

    // Assert
    expect(fraction).toBe(0);
  });
});

describe("runArticleQualityGate", () => {
  it("allows clean article content", () => {
    // Act
    const decision = runArticleQualityGate(
      "https://example.com/article",
      "Bank Central Asia expands regional operations",
      cleanArticleBody(),
    );

    // Assert
    expect(decision).toEqual({ blocked: false });
    expect(
      classifyNonArticleSource(
        "https://example.com/article",
        "Bank Central Asia expands regional operations",
        cleanArticleBody(),
      ),
    ).toBeNull();
  });

  it("blocks empty or challenge-page titles first", () => {
    // Act
    const decision = runArticleQualityGate(
      "https://example.com/challenge",
      "Just a moment...",
      cleanArticleBody(),
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_no_title",
    });
  });

  it("blocks titles shorter than twelve characters", () => {
    // Act
    const decision = runArticleQualityGate(
      "https://example.com/short-title",
      "Short",
      cleanArticleBody(),
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_no_title",
    });
  });

  it("blocks known quote pages via URL prefilter", () => {
    // Act
    const decision = runArticleQualityGate(
      "https://finance.yahoo.com/quote/BBCA.JK/",
      "BBCA Quote Page Title Here",
      cleanArticleBody(),
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "prefilter_blocked_path",
    });
  });

  it("blocks index-like title markers", () => {
    // Act
    const decision = runArticleQualityGate(
      "https://example.com/news/earnings-update",
      "Company profile and key statistics",
      cleanArticleBody(),
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "prefilter_index_title",
    });
  });

  it("blocks soft-404 pages with short bodies", () => {
    // Act
    const decision = runArticleQualityGate(
      "https://example.com/missing",
      "Missing article headline here",
      soft404Body(),
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_soft_404",
    });
  });

  it("blocks paywall stubs with low alphabetic density", () => {
    // Act
    const decision = runArticleQualityGate(
      "https://example.com/paywall",
      "Premium article headline here",
      paywallBody(),
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_access_gated",
    });
  });

  it("blocks bodies below the minimum word count", () => {
    // Act
    const decision = runArticleQualityGate(
      "https://example.com/stub",
      "Wire stub headline here",
      shortBody(),
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_too_short",
    });
  });

  it("blocks nav-heavy repetitive boilerplate", () => {
    // Act
    const decision = runArticleQualityGate(
      "https://example.com/shadow",
      "Shadow article skeleton headline",
      repetitiveBody(),
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_repetitive",
    });
  });

  it("returns the first matching rule only", () => {
    // Act
    const decision = runArticleQualityGate(
      "https://example.com/challenge",
      "Access denied",
      shortBody(),
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_no_title",
    });
  });
});
