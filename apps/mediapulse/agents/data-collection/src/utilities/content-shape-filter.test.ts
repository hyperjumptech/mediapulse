/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { classifyNonArticleContent } from "./content-shape-filter";

describe("classifyNonArticleContent", () => {
  it("allows short content without index markers", () => {
    // Act
    const decision = classifyNonArticleContent("Title", "too short");

    // Assert
    expect(decision).toEqual({ blocked: false });
  });

  it("blocks index-like pages with multiple financial markers", () => {
    // Setup
    const content = `
      Key statistics and financial summary are listed below.
      This company profile page also includes market cap sections.
      ${"word ".repeat(100)}
    `;

    // Act
    const decision = classifyNonArticleContent("Stock overview", content);

    // Assert
    expect(decision).toEqual({
      blocked: true,
      reason: "content_index_like",
    });
  });

  it("allows long article-like content", () => {
    // Setup
    const content = `
      Bank Central Asia announced strategic expansion plans across regional markets.
      The company reported improved margins, higher loan growth, and stronger risk controls.
      ${"analysis ".repeat(120)}
    `;

    // Act
    const decision = classifyNonArticleContent(
      "BCA expands operations",
      content,
    );

    // Assert
    expect(decision).toEqual({ blocked: false });
  });
});
