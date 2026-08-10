import { describe, expect, it } from "vitest";
import { deriveRegistrableDomain } from "./derive-registrable-domain.js";

describe("deriveRegistrableDomain", () => {
  it("returns the registrable domain for a plain .com host", () => {
    expect(
      deriveRegistrableDomain("https://www.nytimes.com/2026/article"),
    ).toBe("nytimes.com");
  });

  it("keeps the full multi-level country suffix", () => {
    expect(
      deriveRegistrableDomain("https://katadata.co.id/finansial/bursa"),
    ).toBe("katadata.co.id");
    expect(deriveRegistrableDomain("https://www.thestar.com.my/business")).toBe(
      "thestar.com.my",
    );
  });

  it("collapses a subdomain onto its registrable domain", () => {
    expect(
      deriveRegistrableDomain("https://finance.detik.com/berita/abc"),
    ).toBe("detik.com");
    expect(
      deriveRegistrableDomain("https://momsmoney.kontan.co.id/news/abc"),
    ).toBe("kontan.co.id");
  });

  it("resolves suffixes absent from the retired hand-rolled list", () => {
    expect(deriveRegistrableDomain("https://news.example.co.za/story")).toBe(
      "example.co.za",
    );
  });

  it("lowercases the host", () => {
    expect(deriveRegistrableDomain("https://WWW.Detik.COM/berita")).toBe(
      "detik.com",
    );
  });

  it("returns an empty string for an unparsable URL", () => {
    expect(deriveRegistrableDomain("not a url")).toBe("");
  });

  it("agrees with the domain OpenPageRank echoes back", () => {
    expect(
      deriveRegistrableDomain("https://www.cnbcindonesia.com/market/x"),
    ).toBe("cnbcindonesia.com");
  });
});
