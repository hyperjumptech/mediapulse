import { describe, expect, it } from "vitest";

import type { NewsletterDraft } from "../newsletter-draft-schema.js";
import {
  groundNewsletterCitations,
  scoreBulletAgainstArticle,
} from "./citation-grounding.js";
import type { SourceForGeneration } from "../types.js";

const bcaArticle: SourceForGeneration = {
  url: "https://example.com/bca-q1",
  title: "Bank Central Asia Q1 results",
  content:
    "Jakarta — Bank Central Asia reported first-quarter net profit of Rp 12.4 trillion in net profit, beating estimates as margins expanded.",
};

const miningArticle: SourceForGeneration = {
  url: "https://example.com/mining",
  title: "Nickel output rises in Sulawesi",
  content:
    "Mining contractors shipped higher nickel ore volumes as smelter demand picked up across eastern Indonesia.",
};

const draftArticle = (
  title: string,
  text: string,
  articleIndex = 1,
): NewsletterDraft["sections"][number]["articles"][number] => ({
  title,
  points: [text],
  articleIndex,
});

const minimalDraft = (
  sections: NewsletterDraft["sections"],
): NewsletterDraft => ({ subject: "Weekly briefing", sections });

const sectionOf = (draft: NewsletterDraft, key: string) =>
  draft.sections.find((section) => section.key === key);

describe("scoreBulletAgainstArticle", () => {
  it("scores grounded earnings bullets above threshold with numeric bonus", () => {
    // Act
    const score = scoreBulletAgainstArticle(
      "Bank Central Asia reported first-quarter net profit of Rp 12.4 trillion in net profit, beating estimates",
      bcaArticle,
    );

    // Assert
    expect(score).toBeGreaterThanOrEqual(0.35);
  });

  it("scores unrelated bullets below threshold against a different article", () => {
    // Act
    const score = scoreBulletAgainstArticle(
      "BCA reported Q1 net profit of Rp 12.4 trillion",
      miningArticle,
    );

    // Assert
    expect(score).toBeLessThan(0.1);
  });

  it("does not ground a fabricated bullet on a coincidental single-digit match", () => {
    // Setup
    const telkomArticle: SourceForGeneration = {
      url: "https://analisadaily.com/berita/baca/1075375/telkom-transformasi-digital",
      title:
        "Di Usia 61 Tahun, Telkom Indonesia Gelorakan Semangat Transformasi Digital Nasional",
      content:
        "PT Telkom Indonesia memasuki usia ke-61 tahun dengan tajuk Siner61 Transformasi di kawasan The Telkom Hub, Jakarta.",
    };

    // Act
    const score = scoreBulletAgainstArticle(
      "XLSMART has deployed over 300 5G sites, with investments in AI-enabled migration and regional infrastructure around IKN.",
      telkomArticle,
    );

    // Assert
    expect(score).toBeLessThan(0.18);
  });

  it("grounds a faithful bullet against a short description-only source", () => {
    // Setup
    const shortSource: SourceForGeneration = {
      url: "https://example.com/bpjph-halal",
      title: "BPJPH 2026 halal year",
      content: "Halal certification becomes mandatory in 2026.",
    };

    // Act
    const score = scoreBulletAgainstArticle(
      "BPJPH declared 2026 the year of halal, and halal certification becomes mandatory in 2026 for food and beverage producers across Indonesia, a material change for coffee chains.",
      shortSource,
    );

    // Assert
    expect(score).toBeGreaterThanOrEqual(0.18);
  });

  it("does not ground an unrelated bullet against a short description-only source", () => {
    // Setup
    const shortSource: SourceForGeneration = {
      url: "https://example.com/bpjph-halal",
      title: "BPJPH 2026 halal year",
      content: "Halal certification becomes mandatory in 2026.",
    };

    // Act
    const score = scoreBulletAgainstArticle(
      "Nickel ore shipments rose across Sulawesi smelters last quarter.",
      shortSource,
    );

    // Assert
    expect(score).toBeLessThan(0.18);
  });

  it("grounds a faithful bullet against a long full-body article where Jaccard cannot", () => {
    // Setup
    const longSource: SourceForGeneration = {
      url: "https://example.com/bpjph-mandate",
      title:
        "BPJPH will require halal certification for food and beverage products starting October 2026",
      content:
        "BPJPH will require halal certification for food and beverage products sold in Indonesia starting October 2026. The agency said the mandatory halal certification covers food, beverage, cosmetics, and pharmaceutical goods, from micro enterprises to large exporters and importers. The head of BPJPH declared 2026 the year of halal for Indonesia and described it as a driver of national economic competitiveness. Officials said halal certification is now a symbol of quality, cleanliness, transparency, and traceability, and invited more than seventy countries to align their halal regulation and standards. The certification requirement is based on a government regulation issued in 2024 and applies across the domestic market for producers of every size.",
    };

    // Act
    const score = scoreBulletAgainstArticle(
      "BPJPH will require halal certification for food and beverage products sold in Indonesia starting October 2026.",
      longSource,
    );

    // Assert
    expect(score).toBeGreaterThanOrEqual(0.18);
  });

  it("grounds a faithful English bullet against an Indonesian-language source via shared anchors", () => {
    // Setup
    const indonesianSource: SourceForGeneration = {
      url: "https://example.com/bpjph-id",
      title: "BPJPH Wajibkan Sertifikasi Halal Mulai Oktober 2026",
      content:
        "Badan Penyelenggara Jaminan Produk Halal BPJPH mewajibkan sertifikasi halal untuk produk makanan, minuman, kosmetik, dan farmasi mulai 18 Oktober 2026 di Indonesia. Kebijakan halal ini menyasar usaha mikro hingga perusahaan besar.",
    };

    // Act
    const score = scoreBulletAgainstArticle(
      "BPJPH will require halal certification for food and beverage products in Indonesia from October 2026.",
      indonesianSource,
    );

    // Assert
    expect(score).toBeGreaterThanOrEqual(0.18);
  });

  it("does not ground an unrelated English bullet against an Indonesian-language source", () => {
    // Setup
    const indonesianSource: SourceForGeneration = {
      url: "https://example.com/bpjph-id",
      title: "BPJPH Wajibkan Sertifikasi Halal Mulai Oktober 2026",
      content:
        "Badan Penyelenggara Jaminan Produk Halal BPJPH mewajibkan sertifikasi halal untuk produk makanan, minuman, kosmetik, dan farmasi mulai 18 Oktober 2026 di Indonesia.",
    };

    // Act
    const score = scoreBulletAgainstArticle(
      "Telkomsel launched a new 5G network across Papua with a large capital investment.",
      indonesianSource,
    );

    // Assert
    expect(score).toBeLessThan(0.18);
  });

  it("does not ground an unrelated bullet against a long full-body article", () => {
    // Setup
    const longSource: SourceForGeneration = {
      url: "https://example.com/bpjph-mandate",
      title:
        "BPJPH will require halal certification for food and beverage products starting October 2026",
      content:
        "BPJPH will require halal certification for food and beverage products sold in Indonesia starting October 2026. The agency said the mandatory halal certification covers food, beverage, cosmetics, and pharmaceutical goods, from micro enterprises to large exporters and importers. The head of BPJPH declared 2026 the year of halal for Indonesia and described it as a driver of national economic competitiveness.",
    };

    // Act
    const score = scoreBulletAgainstArticle(
      "Telkomsel launched a new 5G network across Jakarta with a large investment this quarter.",
      longSource,
    );

    // Assert
    expect(score).toBeLessThan(0.18);
  });
});

describe("groundNewsletterCitations", () => {
  it("removes low-overlap articles under unlink policy", () => {
    // Setup
    const draft = minimalDraft([
      {
        key: "competitive-landscape",
        articles: [
          draftArticle(
            "T1",
            "BCA reported Q1 net profit of Rp 12.4 trillion",
            1,
          ),
          draftArticle("T2", "Unrelated mining shipment volumes rose.", 2),
        ],
      },
    ]);

    // Act
    const result = groundNewsletterCitations(draft, [bcaArticle, bcaArticle], {
      policy: "unlink",
      minOverlapScore: 0.18,
      numericBonus: 0.2,
    });

    // Assert
    const section = sectionOf(result.draft, "competitive-landscape");

    expect(section?.articles).toHaveLength(1);
    expect(section?.articles[0]?.title).toBe("T1");

    const report = result.reports.find(
      (entry) =>
        entry.sectionKey === "competitive-landscape" && entry.bulletIndex === 1,
    );

    expect(report?.decision.kind).toBe("unlink");
    expect(result.summary.unlinked).toBe(1);
  });

  it("downgrades drops to unlink at the section floor", () => {
    // Setup: every article in the section fails, so the floor converts each drop to unlink.
    const draft = minimalDraft([
      {
        key: "competitive-landscape",
        articles: [
          draftArticle("T1", "Unrelated mining shipment volumes rose.", 1),
          draftArticle("T2", "Another unrelated nickel export headline.", 1),
        ],
      },
    ]);

    // Act
    const result = groundNewsletterCitations(draft, [bcaArticle], {
      policy: "drop",
      minOverlapScore: 0.18,
      numericBonus: 0.2,
    });

    // Assert
    expect(
      result.reports.every((report) => report.decision.kind === "unlink"),
    ).toBe(true);
    expect(result.summary.floorPreserved).toBe(2);
    expect(sectionOf(result.draft, "competitive-landscape")).toBeUndefined();
  });

  it("keeps a passing article without invoking the floor", () => {
    // Setup
    const draft = minimalDraft([
      {
        key: "quick-hits",
        articles: [
          draftArticle(
            "G1",
            "Bank Central Asia reported first-quarter net profit of Rp 12.4 trillion.",
            1,
          ),
          draftArticle("F1", "Rain is forecast over the weekend.", 1),
        ],
      },
    ]);

    // Act
    const result = groundNewsletterCitations(draft, [bcaArticle], {
      policy: "drop",
      minOverlapScore: 0.18,
      numericBonus: 0.2,
    });

    // Assert
    expect(sectionOf(result.draft, "quick-hits")?.articles).toHaveLength(1);
    expect(result.quickHitsKeptDespiteFailedGrounding).toBe(0);
  });

  it("rescues the highest-overlap quick hit when every quick hit fails grounding", () => {
    // Setup: the threshold is raised so all three quick hits fail, F2 by the smallest margin.
    // The floor must keep exactly one, and it must be F2.
    const draft = minimalDraft([
      {
        key: "quick-hits",
        articles: [
          draftArticle("F1", "Rain is forecast over the weekend.", 1),
          draftArticle(
            "F2",
            "Bank Central Asia margins were mentioned somewhere.",
            1,
          ),
          draftArticle("F3", "Traffic congestion worsened downtown.", 1),
        ],
      },
    ]);

    // Act
    const result = groundNewsletterCitations(draft, [bcaArticle], {
      policy: "drop",
      minOverlapScore: 0.9,
      numericBonus: 0.2,
    });

    // Assert
    const kept = sectionOf(result.draft, "quick-hits");

    expect(kept?.articles).toHaveLength(1);
    expect(kept?.articles[0]?.title).toBe("F2");
    expect(result.quickHitsKeptDespiteFailedGrounding).toBe(1);
  });

  it("passes every article through under warn policy", () => {
    // Setup
    const draft = minimalDraft([
      {
        key: "deals-and-movements",
        articles: [draftArticle("T1", "Completely unrelated headline.", 1)],
      },
    ]);

    // Act
    const result = groundNewsletterCitations(draft, [bcaArticle], {
      policy: "warn",
      minOverlapScore: 0.18,
      numericBonus: 0.2,
    });

    // Assert
    expect(
      sectionOf(result.draft, "deals-and-movements")?.articles,
    ).toHaveLength(1);
    expect(result.summary.dropped).toBe(0);
    expect(result.summary.unlinked).toBe(0);
  });

  it("treats an out-of-range articleIndex as no_source", () => {
    // Setup
    const draft = minimalDraft([
      {
        key: "deals-and-movements",
        articles: [draftArticle("T1", "A deal closed.", 99)],
      },
    ]);

    // Act
    const result = groundNewsletterCitations(draft, [bcaArticle], {
      policy: "drop",
      minOverlapScore: 0.18,
      numericBonus: 0.2,
    });

    // Assert
    const report = result.reports[0];

    expect(
      report?.decision.kind === "unlink" || report?.decision.kind === "drop",
    ).toBe(true);
    expect(
      report?.decision.kind !== "pass" ? report?.decision.reason : undefined,
    ).toBe("no_source");
  });
});
