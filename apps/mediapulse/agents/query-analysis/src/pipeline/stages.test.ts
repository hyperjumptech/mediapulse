/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { LANGUAGES } from "../constants";
import {
  bestIndustryLabel,
  deriveClassification,
  deriveMarketContext,
} from "./context";
import { buildCompetitorCandidates } from "./stage-competitors";
import { buildIndustryCandidates } from "./stage-industry";
import {
  buildOwnCompanyCandidates,
  CORPORATE_ACTION_TERMS,
} from "./stage-own-company";
import { buildRegulatorCandidates } from "./stage-regulators";

describe("deriveClassification", () => {
  it("drops null/blank fields and keeps present ones", () => {
    const classification = deriveClassification({
      id: "t",
      symbol: "BBRI",
      name: "Bank",
      sector: "Keuangan",
      industry: "  ",
      subSector: null,
      businessActivity: "Perbankan",
    });

    expect(classification).toEqual({
      sector: "Keuangan",
      businessActivity: "Perbankan",
    });
  });
});

describe("bestIndustryLabel", () => {
  it("prefers the most specific available label", () => {
    expect(
      bestIndustryLabel({ sector: "Keuangan", subIndustry: "Bank BUKU IV" }),
    ).toBe("Bank BUKU IV");
    expect(bestIndustryLabel({ sector: "Keuangan" })).toBe("Keuangan");
    expect(bestIndustryLabel({})).toBeUndefined();
  });
});

describe("buildOwnCompanyCandidates", () => {
  it("emits symbol/name (breaking) and corporate-action terms (deals) per language", () => {
    const candidates = buildOwnCompanyCandidates(
      { symbol: "BBRI", name: "Bank Rakyat Indonesia" },
      LANGUAGES,
    );

    const breaking = candidates.filter((c) => c.intent === "breaking");
    const deals = candidates.filter((c) => c.intent === "deals");
    expect(breaking.map((c) => c.text)).toContain("BBRI");
    expect(deals).toHaveLength(
      CORPORATE_ACTION_TERMS.length * LANGUAGES.length,
    );
  });
});

describe("buildCompetitorCandidates / buildRegulatorCandidates", () => {
  it("emits name and name+keyword under the right intent", () => {
    const competitors = buildCompetitorCandidates(
      [{ name: "Bank Mandiri", aliases: [], searchKeywords: ["kredit"] }],
      ["id"],
      2,
    );
    expect(competitors.map((c) => c.text)).toEqual([
      "Bank Mandiri",
      "Bank Mandiri kredit",
    ]);
    expect(competitors.every((c) => c.intent === "competitor")).toBe(true);

    const regulators = buildRegulatorCandidates(
      [{ name: "OJK", aliases: [], searchKeywords: ["regulasi"] }],
      ["id"],
      2,
    );
    expect(regulators.every((c) => c.intent === "regulatory")).toBe(true);
  });
});

describe("buildIndustryCandidates", () => {
  it("anchors themes to the home market across languages", () => {
    const candidates = buildIndustryCandidates(
      { industry: "Bank" },
      deriveMarketContext(),
      LANGUAGES,
    );

    expect(candidates.every((c) => c.text.includes("Indonesia"))).toBe(true);
    expect(candidates.some((c) => c.intent === "industry_trend")).toBe(true);
    expect(candidates.some((c) => c.intent === "technology_trend")).toBe(true);
    expect(candidates.some((c) => c.intent === "macro")).toBe(true);
    expect(candidates.some((c) => c.intent === "wildcard")).toBe(true);
  });

  it("falls back to the home market label when classification is empty", () => {
    const candidates = buildIndustryCandidates({}, deriveMarketContext(), [
      "en",
    ]);
    expect(candidates.length).toBeGreaterThan(0);
  });
});
