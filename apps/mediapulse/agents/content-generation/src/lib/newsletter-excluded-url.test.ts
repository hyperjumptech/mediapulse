import { describe, expect, it } from "vitest";

import {
  newsletterExclusionOf,
  withoutNewsletterExclusions,
} from "./newsletter-excluded-url.js";

const GOOGLE_NEWS_LINK =
  "https://news.google.com/rss/articles/CBMirAFBVV95cUxPM294bDFIdHl6YUsxTVlWT21BQWRHN21ZTk9uZGlKMWhDamtwTXJf?oc=5";

describe("newsletterExclusionOf", () => {
  it("excludes a Google News redirect link the pipeline cannot resolve", () => {
    // Assert
    expect(newsletterExclusionOf(GOOGLE_NEWS_LINK)).toBe("blocked_host");
  });

  it("excludes a reader-contributed host", () => {
    // Assert
    expect(
      newsletterExclusionOf(
        "https://www.readers.id/read/telkom-perluas-jaringan-fiber-di-ntt",
      ),
    ).toBe("user_generated");
  });

  it("keeps an editorial article", () => {
    // Assert
    expect(
      newsletterExclusionOf(
        "https://money.kompas.com/read/2026/10/29/142831426/laba-antm-tembus-rp-966-triliun-apa-katalis-sahamnya",
      ),
    ).toBeUndefined();
  });
});

describe("withoutNewsletterExclusions", () => {
  it("drops excluded sources and keeps the rest in order", () => {
    // Arrange
    const sources = [
      { id: "a", url: "https://www.swa.co.id/read/telkom-laba-naik" },
      { id: "b", url: GOOGLE_NEWS_LINK },
      { id: "c", url: "https://www.readers.id/read/opini-tarif-ojol" },
      {
        id: "d",
        url: "https://www.ojk.go.id/id/berita-dan-kegiatan/siaran-pers/Pages/OJK-Terbitkan-Aturan-Penjaminan-Polis.aspx",
      },
    ];

    // Act
    const kept = withoutNewsletterExclusions(sources);

    // Assert
    expect(kept.map((source) => source.id)).toEqual(["a", "d"]);
  });
});
