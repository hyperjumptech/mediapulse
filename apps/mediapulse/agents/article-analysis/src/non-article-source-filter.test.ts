/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { classifyNonArticleSource } from "./non-article-source-filter.js";

describe("classifyNonArticleSource", () => {
  it("blocks known quote pages", () => {
    // Act
    const result = classifyNonArticleSource(
      "https://finance.yahoo.com/quote/BBCA.JK/",
      "BBCA Quote Page Title",
      "Some long placeholder content ".repeat(20),
    );

    // Assert
    expect(result).toBe("prefilter_blocked_path");
  });

  it("maps blocked_host from the shared URL classifier", () => {
    // Act
    const result = classifyNonArticleSource(
      "https://www.linkedin.com/posts/example_company-update",
      "LinkedIn company update post",
      "content",
    );

    // Assert
    expect(result).toBe("prefilter_blocked_host");
  });

  it("blocks index-like title markers", () => {
    // Act
    const result = classifyNonArticleSource(
      "https://example.com/news/earnings-update",
      "Company profile and key statistics",
      "short content",
    );

    // Assert
    expect(result).toBe("prefilter_index_title");
  });

  it("allows article-like source", () => {
    // Act
    const result = classifyNonArticleSource(
      "https://example.com/news/company-expands",
      "Company expands in Southeast Asia",
      "The company announced expansion and reported improved earnings momentum. ".repeat(
        15,
      ),
    );

    // Assert
    expect(result).toBeNull();
  });
});
