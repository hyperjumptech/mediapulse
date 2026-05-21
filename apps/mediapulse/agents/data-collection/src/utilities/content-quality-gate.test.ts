/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  createEmptyQualityCounters,
  maxShingleFraction,
  runQualityGate,
} from "./content-quality-gate";

/** Builds article-like body text with at least 80 unique words. */
const cleanArticleBody = (): string =>
  [
    "Bank Central Asia announced strategic expansion plans across regional markets.",
    "The company reported improved margins, higher loan growth, and stronger risk controls.",
    ...Array.from(
      { length: 90 },
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

/** Builds nav-heavy body where one six-word shingle exceeds 20% of shingles. */
const repetitiveBody = (): string =>
  `${"home about contact ".repeat(150)}${Array.from({ length: 40 }, (_, index) => `filler paragraph ${index} with unique words`).join(" ")}`;

describe("createEmptyQualityCounters", () => {
  it("returns zeroed counters for every drop reason", () => {
    // Act
    const counters = createEmptyQualityCounters();

    // Assert
    expect(counters).toEqual({
      content_no_title: 0,
      content_soft_404: 0,
      content_access_gated: 0,
      content_too_short: 0,
      content_repetitive: 0,
      content_link_farm: 0,
      content_index_like: 0,
    });
  });
});

describe("maxShingleFraction", () => {
  it("returns zero when content has fewer words than the shingle width", () => {
    // Act
    const fraction = maxShingleFraction("one two three", 6);

    // Assert
    expect(fraction).toBe(0);
  });
});

describe("runQualityGate", () => {
  it("allows clean article content", () => {
    // Act
    const decision = runQualityGate(
      "Bank Central Asia expands regional operations",
      cleanArticleBody(),
      "https://example.com/article",
    );

    // Assert
    expect(decision).toEqual({ blocked: false });
  });

  it("blocks empty or challenge-page titles first", () => {
    // Act
    const decision = runQualityGate(
      "Just a moment...",
      cleanArticleBody(),
      "https://example.com/challenge",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_no_title",
    });
  });

  it("blocks titles shorter than twelve characters", () => {
    // Act
    const decision = runQualityGate(
      "Short",
      cleanArticleBody(),
      "https://example.com/short-title",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_no_title",
    });
  });

  it("blocks soft-404 pages with short bodies", () => {
    // Act
    const decision = runQualityGate(
      "Missing article headline here",
      soft404Body(),
      "https://example.com/missing",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_soft_404",
    });
  });

  it("blocks access-gated stubs with thin prose density", () => {
    // Act
    const decision = runQualityGate(
      "Premium article headline here",
      paywallBody(),
      "https://example.com/paywall",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_access_gated",
    });
  });

  it("blocks bodies below the minimum word count", () => {
    // Act
    const decision = runQualityGate(
      "Valid headline for short body",
      shortBody(),
      "https://example.com/short",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_too_short",
    });
  });

  it("blocks repetitive nav-heavy boilerplate", () => {
    // Setup
    expect(maxShingleFraction(repetitiveBody())).toBeGreaterThan(0.2);

    // Act
    const decision = runQualityGate(
      "Valid headline for repetitive body",
      repetitiveBody(),
      "https://example.com/nav-heavy",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_repetitive",
    });
  });

  it("blocks link-farm pages with high link density", () => {
    // Setup
    const content = `${Array.from({ length: 120 }, (_, index) => `https://example.com/page-${index}`).join(" ")} ${"word ".repeat(20)}`;

    // Act
    const decision = runQualityGate(
      "Link roundup headline",
      content,
      "https://example.com/links",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_link_farm",
    });
  });

  it("blocks index-like pages with multiple financial markers", () => {
    // Setup
    const variedBody = Array.from(
      { length: 100 },
      (_, index) =>
        `Detail paragraph ${index} covers lending trends and deposit growth.`,
    ).join(" ");
    const content = `
      Key statistics and financial summary are listed below.
      This company profile page also includes market cap sections.
      ${variedBody}
    `;

    // Act
    const decision = runQualityGate(
      "Stock overview headline",
      content,
      "https://example.com/stocks",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_index_like",
    });
  });

  it("returns the first matching rule reason", () => {
    // Act
    const decision = runQualityGate(
      "Access denied",
      shortBody(),
      "https://example.com/multi-signal",
    );

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_no_title",
    });
  });
});

describe("classifyNonArticleContent alias", () => {
  it("re-exports runQualityGate behavior", async () => {
    // Setup
    const { classifyNonArticleContent } =
      await import("./content-shape-filter");

    // Act
    const decision = classifyNonArticleContent(
      "Bank Central Asia expands regional operations",
      cleanArticleBody(),
    );

    // Assert
    expect(decision).toEqual({ blocked: false });
  });
});
