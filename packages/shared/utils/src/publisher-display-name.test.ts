import { describe, expect, it } from "vitest";
import {
  publisherNameFromSiteMetadata,
  publisherNameMatchesDomain,
  sanitizePublisherDisplayName,
} from "./publisher-display-name.js";

describe("publisherNameFromSiteMetadata", () => {
  it("rejects a section name a subdomain declares as its site name", () => {
    const name = publisherNameFromSiteMetadata(
      "Metropolis",
      "https://metropolis.batampos.co.id/li-claudia-hadiri-tech-week",
    );

    expect(name).toBe("");
  });

  it("rejects a company's legal name", () => {
    const name = publisherNameFromSiteMetadata(
      "PT. Kontan Grahanusa Mediatama",
      "https://stocksetup.kontan.co.id/news/gems-segera-tebar-dividen",
    );

    expect(name).toBe("");
  });

  it("keeps the brand from a headline or tagline joined to it", () => {
    const fromHeadline = publisherNameFromSiteMetadata(
      "10 UMKM Pangan Tembus Jaringan Ritel AEON Indonesia - Sindikat Post",
      "https://sindikatpost.com/a",
    );
    const fromTagline = publisherNameFromSiteMetadata(
      "beritajatim.com | Portal Berita Jawa Timur Hari Ini",
      "https://beritajatim.com/a",
    );
    const fromBareHyphen = publisherNameFromSiteMetadata(
      "INFODESANEWS-Bersama membangun Indonesia",
      "https://infodesanews.com/a",
    );

    expect(fromHeadline).toBe("Sindikat Post");
    expect(fromTagline).toBe("beritajatim.com");
    expect(fromBareHyphen).toBe("INFODESANEWS");
  });

  it("rejects a tagline whose parts never name the site", () => {
    const name = publisherNameFromSiteMetadata(
      "Faktual Indonesia: Menebar Fakta, Menuai Kebenaran",
      "https://faktualid.com/a",
    );

    expect(name).toBe("");
  });

  it("rejects another site's domain", () => {
    const name = publisherNameFromSiteMetadata(
      "KOMPAS.tv",
      "https://harianumum.com/a",
    );

    expect(name).toBe("");
  });

  it("rejects a headline that does not name the site", () => {
    const name = publisherNameFromSiteMetadata(
      "BI Dorong Hilirisasi dan Digitalisasi untuk Perkuat Ekonomi Lampung",
      "https://kupastuntas.co/a",
    );

    expect(name).toBe("");
  });

  it("reads a URL given as the site name as its hostname", () => {
    const name = publisherNameFromSiteMetadata(
      "https://www.indonesiabusinesspost.com/",
      "https://indonesiabusinesspost.com/a",
    );

    expect(name).toBe("indonesiabusinesspost.com");
  });

  it("keeps a real name even when it shares nothing with the domain", () => {
    const quartz = publisherNameFromSiteMetadata("Quartz", "https://qz.com/a");
    const university = publisherNameFromSiteMetadata(
      "Universitas Airlangga",
      "https://unair.ac.id/a",
    );

    expect(quartz).toBe("Quartz");
    expect(university).toBe("Universitas Airlangga");
  });

  it("keeps a name that spells out the domain's brand", () => {
    const name = publisherNameFromSiteMetadata(
      "The Jakarta Post",
      "https://www.thejakartapost.com/business/a",
    );

    expect(name).toBe("The Jakarta Post");
  });

  it("still rejects generic placeholders", () => {
    expect(publisherNameFromSiteMetadata("Home", "https://a.com/x")).toBe("");
    expect(
      publisherNameFromSiteMetadata("Umum", "https://kuatbaca.com/x"),
    ).toBe("");
  });
});

describe("sanitizePublisherDisplayName", () => {
  it("keeps a real publisher name and collapses its whitespace", () => {
    expect(sanitizePublisherDisplayName("  The Jakarta  Post ")).toBe(
      "The Jakarta Post",
    );
  });

  it("rejects a generic placeholder site name", () => {
    expect(sanitizePublisherDisplayName("Home")).toBe("");
    expect(sanitizePublisherDisplayName("beranda")).toBe("");
    expect(sanitizePublisherDisplayName("Google News")).toBe("");
  });

  it("rejects an empty, absent, or letterless value", () => {
    expect(sanitizePublisherDisplayName("   ")).toBe("");
    expect(sanitizePublisherDisplayName(undefined)).toBe("");
    expect(sanitizePublisherDisplayName(null)).toBe("");
    expect(sanitizePublisherDisplayName("2026")).toBe("");
  });

  it("rejects a value long enough to be a headline rather than a name", () => {
    const headline = "A".repeat(81);

    expect(sanitizePublisherDisplayName(headline)).toBe("");
  });
});

describe("publisherNameMatchesDomain", () => {
  it("accepts a name that only adds spacing and casing", () => {
    expect(
      publisherNameMatchesDomain("The Jakarta Post", "thejakartapost.com"),
    ).toBe(true);
    expect(
      publisherNameMatchesDomain("Bloomberg Technoz", "bloombergtechnoz.com"),
    ).toBe(true);
    expect(
      publisherNameMatchesDomain("CNBC Indonesia", "cnbcindonesia.com"),
    ).toBe(true);
  });

  it("accepts a name for a multi-level country suffix", () => {
    expect(publisherNameMatchesDomain("Kontan", "kontan.co.id")).toBe(true);
  });

  it("rejects a name that adds or drops a word", () => {
    expect(
      publisherNameMatchesDomain(
        "Bloomberg Technology",
        "bloombergtechnoz.com",
      ),
    ).toBe(false);
    expect(publisherNameMatchesDomain("Antara", "antaranews.com")).toBe(false);
  });

  it("rejects a name for a domain with no brand token", () => {
    expect(publisherNameMatchesDomain("Anything", "not a domain")).toBe(false);
  });
});
