/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { buildPrompt, EXPECTED_QUERY_COUNT } from "./build-prompt";

describe("buildPrompt", () => {
  it("builds cold-start prompt without warm context sections", () => {
    // Setup
    const context = {
      ticker: {
        id: "7fe31efd-36ff-4d81-97ec-f7b6bcf57fdf",
        symbol: "BBCA",
        name: "Bank Central Asia Tbk",
        metadata: {
          Sektor: "Keuangan",
          Industri: "Perbankan",
          SubIndustri: "Bank Umum",
          KegiatanUsahaUtama: "Jasa perbankan",
        },
      },
      topEntities: [],
      recentThemes: [],
    };

    // Act
    const prompt = buildPrompt(context);

    // Assert
    expect(prompt.systemPrompt).toContain(
      `Generate exactly ${EXPECTED_QUERY_COUNT} query strings.`,
    );
    expect(prompt.userPrompt).toContain("Ticker: BBCA");
    expect(prompt.userPrompt).toContain(
      "There is no prior knowledge graph for this ticker yet.",
    );
    expect(prompt.userPrompt).not.toContain(
      "Known entities in this ticker's knowledge graph",
    );
  });

  it("builds warm prompt with entities and themes", () => {
    // Setup
    const context = {
      ticker: {
        id: "8622a5fc-3c6c-4e10-88f6-5c23ce4373bb",
        symbol: "TLKM",
        name: "Telkom Indonesia",
        metadata: {
          Sektor: "Infrastruktur",
          Industri: "Telekomunikasi",
        },
      },
      topEntities: [
        { canonicalName: "Telkomsel", typeName: "ORG", relevanceWeight: 0.8 },
      ],
      recentThemes: [{ theme: "5G rollout", articleCount: 4 }],
    };

    // Act
    const prompt = buildPrompt(context);

    // Assert
    expect(prompt.userPrompt).toContain(
      "Known entities in this ticker's knowledge graph",
    );
    expect(prompt.userPrompt).toContain("- Telkomsel (ORG)");
    expect(prompt.userPrompt).toContain(
      "- 5G rollout (appeared in 4 articles)",
    );
    expect(prompt.userPrompt).toContain(
      "Discover NEW developments not yet in the knowledge graph.",
    );
  });

  it("falls back unknown metadata values when metadata is empty", () => {
    // Setup
    const context = {
      ticker: {
        id: "f290edcd-f367-42f4-b8f9-0e6c8de9f932",
        symbol: "ASII",
        name: "Astra International",
        metadata: null,
      },
      topEntities: [
        {
          canonicalName: "Astra Otoparts",
          typeName: "ORG",
          relevanceWeight: 0.7,
        },
      ],
      recentThemes: [],
    };

    // Act
    const prompt = buildPrompt(context);

    // Assert
    expect(prompt.userPrompt).toContain("Sector: Unknown");
    expect(prompt.userPrompt).toContain("Industry: Unknown");
    expect(prompt.userPrompt).toContain("Sub-industry: Unknown");
    expect(prompt.userPrompt).toContain("Business: Unknown");
  });
});
