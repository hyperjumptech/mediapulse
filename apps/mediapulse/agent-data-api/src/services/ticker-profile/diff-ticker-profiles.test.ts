import { describe, expect, it } from "vitest";

import {
  diffTickerProfile,
  summarizeTickerProfileDiffs,
} from "./diff-ticker-profiles.js";
import type { TickerProfileRecord } from "./ticker-profile-source.js";

const profile = (
  overrides: Partial<TickerProfileRecord> = {},
): TickerProfileRecord => ({
  companyOverview: "Overview.",
  businessOperation: "Operation.",
  sectorIndonesian: "Sektor",
  sectorEnglish: "Sector",
  subSectorIndonesian: "Subsektor",
  subSectorEnglish: "Sub-sector",
  industryIndonesian: "Industri",
  industryEnglish: "Industry",
  subIndustryIndonesian: "Subindustri",
  subIndustryEnglish: "Sub-industry",
  aliases: [],
  competitors: [],
  regulators: [],
  ...overrides,
});

describe("diffTickerProfile", () => {
  it("reports added and removed aliases, ignoring case, and flags short new aliases", () => {
    const diff = diffTickerProfile(
      "MAPB",
      true,
      profile({ aliases: ["MAPB", "Starbucks", "Old Name"] }),
      profile({ aliases: ["mapb", "Starbucks", "MBA", "Krispy Kreme"] }),
    );

    expect(diff.status).toBe("both");
    expect(diff.aliasesAdded).toEqual(["MBA", "Krispy Kreme"]);
    expect(diff.aliasesRemoved).toEqual(["Old Name"]);
    expect(diff.shortAliasesAdded).toEqual(["MBA"]);
  });

  it("treats a regulator found through an alias as renamed, not removed", () => {
    const diff = diffTickerProfile(
      "FORE",
      true,
      profile({
        regulators: [
          { name: "Financial Services Authority", aliases: ["OJK"] },
          { name: "Ministry of Trade", aliases: [] },
        ],
      }),
      profile({
        regulators: [
          { name: "BPOM", aliases: [] },
          { name: "OJK", aliases: ["Financial Services Authority"] },
        ],
      }),
    );

    expect(diff.regulators).toEqual({
      added: ["BPOM"],
      removed: ["Ministry of Trade"],
      renamed: [{ from: "Financial Services Authority", to: "OJK" }],
    });
    expect(diff.welcomeRegulatorOverlap).toBe(1);
  });

  it("counts how much of the recon and welcome top lists survives", () => {
    const names = ["A", "B", "C", "D", "E", "F"];
    const databaseCompetitors = names.map((name) => ({ name, aliases: [] }));
    const organonCompetitors = ["A", "C", "X", "Y", "B"].map((name) => ({
      name,
      aliases: [],
    }));

    const diff = diffTickerProfile(
      "FORE",
      false,
      profile({ competitors: databaseCompetitors }),
      profile({ competitors: organonCompetitors }),
    );

    expect(diff.reconCompetitorOverlap).toBe(2);
    expect(diff.welcomeCompetitorOverlap).toBe(3);
    expect(diff.competitors.removed).toEqual(["D", "E", "F"]);
    expect(diff.competitors.added).toEqual(["X", "Y"]);
  });

  it("reports changed and blank text fields", () => {
    const diff = diffTickerProfile(
      "TLKM",
      true,
      profile({ companyOverview: "Old overview." }),
      profile({ companyOverview: "New overview.", subIndustryIndonesian: " " }),
    );

    expect(diff.changedText).toEqual([
      "companyOverview",
      "subIndustryIndonesian",
    ]);
    expect(diff.blankInOrganon).toEqual(["subIndustryIndonesian"]);
    expect(diff.blankInDatabase).toEqual([]);
  });

  it("classifies tickers missing on one side", () => {
    expect(diffTickerProfile("A", true, profile(), undefined).status).toBe(
      "databaseOnly",
    );
    expect(diffTickerProfile("B", true, undefined, profile()).status).toBe(
      "organonOnly",
    );
    expect(diffTickerProfile("C", true, undefined, undefined).status).toBe(
      "neither",
    );
  });
});

describe("summarizeTickerProfileDiffs", () => {
  it("lists active tickers that Organon is missing", () => {
    const summary = summarizeTickerProfileDiffs([
      diffTickerProfile("AAAA", true, profile(), undefined),
      diffTickerProfile("BBBB", false, profile(), undefined),
      diffTickerProfile("CCCC", true, profile(), profile()),
    ]);

    expect(summary.status).toEqual({
      both: 1,
      databaseOnly: 2,
      organonOnly: 0,
      neither: 0,
    });
    expect(summary.activeMissingFromOrganon).toEqual(["AAAA"]);
  });
});
