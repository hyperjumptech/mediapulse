import { describe, expect, it } from "vitest";

import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";
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

const minimalStructure = (
  patch: Partial<IndustryNewsletterStructure> = {},
): IndustryNewsletterStructure => ({
  subject: "Weekly briefing",
  industryPulse: { displayHeading: "Pulse", prose: "Markets moved." },
  competitiveLandscape: {
    displayHeading: "Competitive",
    bullets: [
      { title: "T1", text: "Peer A expanded share.", articleIndex: 1 },
      { title: "T2", text: "Peer B held steady.", articleIndex: 1 },
    ],
  },
  dealsAndMovements: {
    displayHeading: "Deals",
    bullets: [{ title: "T3", text: "No major deals.", articleIndex: 1 }],
  },
  regulatoryPolicyWatch: {
    displayHeading: "Policy",
    bullets: [{ title: "T4", text: "Rules unchanged.", articleIndex: 1 }],
  },
  disruptorsOrTech: {
    format: "prose",
    displayHeading: "Tech",
    prose: "Automation continued.",
  },
  quickHits: {
    displayHeading: "Hits",
    items: [
      { title: "Q1", text: "Hit 1", articleIndex: 1 },
      { title: "Q2", text: "Hit 2", articleIndex: 1 },
      { title: "Q3", text: "Hit 3", articleIndex: 1 },
      { title: "Q4", text: "Hit 4", articleIndex: 1 },
      { title: "Q5", text: "Hit 5", articleIndex: 1 },
    ],
  },
  ...patch,
});

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
  it("unlinks low-overlap optional bullets under unlink policy", () => {
    // Setup
    const structure = minimalStructure({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          {
            title: "T1",
            text: "BCA reported Q1 net profit of Rp 12.4 trillion",
            articleIndex: 1,
          },
          {
            title: "T2",
            text: "Unrelated mining shipment volumes rose.",
            articleIndex: 2,
          },
        ],
      },
    });

    // Act
    const result = groundNewsletterCitations(
      structure,
      [bcaArticle, miningArticle],
      {
        policy: "unlink",
        minOverlapScore: 0.18,
        numericBonus: 0.2,
      },
    );

    // Assert
    const badBullet = result.structure.competitiveLandscape.bullets[1];
    expect(badBullet?.text).toContain("mining shipment");
    expect(badBullet?.articleIndex).toBeUndefined();
    const report = result.reports.find(
      (entry) =>
        entry.sectionKey === "competitiveLandscape" && entry.bulletIndex === 1,
    );
    expect(report?.decision.kind).toBe("unlink");
  });

  it("downgrades competitiveLandscape drops to unlink at the schema floor", () => {
    // Setup
    const structure = minimalStructure({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          {
            title: "T1",
            text: "Unrelated mining shipment volumes rose.",
            articleIndex: 1,
          },
          {
            title: "T2",
            text: "Another unrelated nickel export headline.",
            articleIndex: 1,
          },
        ],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [{ title: "T3", text: "No major deals this week." }],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Policy",
        bullets: [{ title: "T4", text: "Rules unchanged this week." }],
      },
      quickHits: {
        displayHeading: "Hits",
        items: [
          {
            title: "Q1",
            text: "Nickel ore volumes increased.",
            articleIndex: 1,
          },
          { title: "Q2", text: "Smelter demand picked up.", articleIndex: 1 },
          {
            title: "Q3",
            text: "Mining contractors shipped more ore.",
            articleIndex: 1,
          },
          {
            title: "Q4",
            text: "Eastern Indonesia output rose.",
            articleIndex: 1,
          },
          {
            title: "Q5",
            text: "Higher nickel ore volumes noted.",
            articleIndex: 1,
          },
        ],
      },
    });

    // Act
    const result = groundNewsletterCitations(structure, [miningArticle], {
      policy: "drop",
      minOverlapScore: 0.18,
      numericBonus: 0.2,
    });

    // Assert
    expect(result.structure.competitiveLandscape.bullets).toHaveLength(2);
    expect(
      result.structure.competitiveLandscape.bullets.every(
        (bullet) => bullet.articleIndex === undefined,
      ),
    ).toBe(true);
    expect(result.summary.floorPreserved).toBe(2);
  });

  it("keeps only the minimum highest-overlap quick hits when grounding fails", () => {
    // Setup: 3 grounded + 4 failing quick hits; the floor of 5 should keep the 3 grounded plus
    // exactly 2 of the failures, not pad with all four.
    const structure = minimalStructure({
      quickHits: {
        displayHeading: "Hits",
        items: [
          {
            title: "G1",
            text: "Bank Central Asia reported first-quarter net profit of Rp 12.4 trillion.",
            articleIndex: 1,
          },
          {
            title: "G2",
            text: "Bank Central Asia first-quarter net profit reached Rp 12.4 trillion, beating estimates.",
            articleIndex: 1,
          },
          {
            title: "G3",
            text: "Bank Central Asia reported Rp 12.4 trillion in first-quarter net profit as margins expanded.",
            articleIndex: 1,
          },
          {
            title: "F1",
            text: "Rain is forecast over the weekend.",
            articleIndex: 1,
          },
          {
            title: "F2",
            text: "A local festival drew large crowds.",
            articleIndex: 1,
          },
          {
            title: "F3",
            text: "Traffic congestion worsened downtown.",
            articleIndex: 1,
          },
          {
            title: "F4",
            text: "A new cafe opened in the suburbs.",
            articleIndex: 1,
          },
        ],
      },
    });

    // Act
    const result = groundNewsletterCitations(structure, [bcaArticle], {
      policy: "drop",
      minOverlapScore: 0.18,
      numericBonus: 0.2,
    });

    // Assert
    expect(result.structure.quickHits.items).toHaveLength(5);
    expect(result.quickHitsKeptDespiteFailedGrounding).toBe(2);
  });
});
