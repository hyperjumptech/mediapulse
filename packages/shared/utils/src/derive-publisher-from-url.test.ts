import { describe, expect, it } from "vitest";
import { derivePublisherFromUrl } from "./derive-publisher-from-url.js";

describe("derivePublisherFromUrl", () => {
  it("returns the brand label for a plain .com host", () => {
    expect(derivePublisherFromUrl("https://www.nytimes.com/2026/article")).toBe(
      "Nytimes",
    );
  });

  it("handles multi-level country suffixes", () => {
    expect(derivePublisherFromUrl("https://www.thestar.com.my/business")).toBe(
      "Thestar",
    );
    expect(
      derivePublisherFromUrl("https://katadata.co.id/finansial/bursa"),
    ).toBe("Katadata");
  });

  it("handles non-commercial Indonesian suffixes", () => {
    expect(
      derivePublisherFromUrl("https://www.bappenas.go.id/id/berita/abc"),
    ).toBe("Bappenas");
    expect(derivePublisherFromUrl("https://stiestekom.ac.id/berita/abc")).toBe(
      "Stiestekom",
    );
    expect(derivePublisherFromUrl("https://www.kemenperin.or.id/artikel")).toBe(
      "Kemenperin",
    );
  });

  it("picks the brand from a deeper subdomain on a country suffix", () => {
    expect(
      derivePublisherFromUrl("https://momsmoney.kontan.co.id/news/abc"),
    ).toBe("Kontan");
  });

  it("ignores a language/region subdomain on a .com host", () => {
    expect(derivePublisherFromUrl("https://id.tradingview.com/news/xyz")).toBe(
      "Tradingview",
    );
  });

  it("returns an empty string for an unparsable URL", () => {
    expect(derivePublisherFromUrl("not a url")).toBe("");
  });
});
