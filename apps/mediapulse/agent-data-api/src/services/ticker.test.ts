/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
}));

import { getTickerForAgent } from "./ticker";
import {
  createInMemoryTickerProfileSource,
  type TickerProfileRecord,
} from "./ticker-profile/ticker-profile-source.js";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

const blankProfile: TickerProfileRecord = {
  companyOverview: "",
  businessOperation: "",
  companyOverviewIndonesian: "",
  businessOperationIndonesian: "",
  names: [],
  brands: [],
  subsidiaries: [],
  ambiguousNames: [],
  commodities: [],
  regulations: [],
  sectorIndonesian: "",
  sectorEnglish: "",
  subSectorIndonesian: "",
  subSectorEnglish: "",
  industryIndonesian: "",
  industryEnglish: "",
  subIndustryIndonesian: "",
  subIndustryEnglish: "",
  aliases: [],
  competitors: [],
  regulators: [],
};

const dbReturning = (row: unknown) => {
  const findUnique = vi.fn().mockResolvedValue(row);

  return { db: { ticker: { findUnique } } as never, findUnique };
};

const noProfiles = createInMemoryTickerProfileSource(new Map());

describe("getTickerForAgent", () => {
  it("returns null when the ticker row is missing", async () => {
    const { db } = dbReturning(null);

    const result = await getTickerForAgent(TICKER_ID, db, noProfiles);

    expect(result).toBeNull();
  });

  it("reads only the symbol and the name from the ticker row", async () => {
    const { db, findUnique } = dbReturning({
      id: TICKER_ID,
      symbol: "XYZ",
      name: "Example Corp",
    });

    await getTickerForAgent(TICKER_ID, db, noProfiles);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: TICKER_ID },
      select: { id: true, symbol: true, name: true },
    });
  });

  it("fills aliases and the Indonesian classification from the profile", async () => {
    const { db } = dbReturning({
      id: TICKER_ID,
      symbol: "AGRO",
      name: "PT Bank Raya Indonesia Tbk",
    });
    const profileSource = createInMemoryTickerProfileSource(
      new Map([
        [
          "AGRO",
          {
            ...blankProfile,
            businessOperation: "Perbankan digital",
            companyOverviewIndonesian: "",
            businessOperationIndonesian: "",
            names: [],
            brands: [],
            subsidiaries: [],
            ambiguousNames: [],
            commodities: [],
            regulations: [],
            sectorIndonesian: "Keuangan",
            sectorEnglish: "Financials",
            subSectorIndonesian: "Bank",
            industryIndonesian: "Bank",
            subIndustryIndonesian: "",
            aliases: ["BRI Agro", "Bank Agroniaga", " bri agro ", ""],
          },
        ],
      ]),
    );

    const result = await getTickerForAgent(TICKER_ID, db, profileSource);

    expect(result).toEqual({
      id: TICKER_ID,
      symbol: "AGRO",
      name: "PT Bank Raya Indonesia Tbk",
      aliases: ["BRI Agro", "Bank Agroniaga"],
      sector: "Keuangan",
      industry: "Bank",
      subSector: "Bank",
      subIndustry: null,
      businessActivity: "Perbankan digital",
      peers: [],
    });
  });

  it("returns empty aliases and null classification without a profile", async () => {
    const { db } = dbReturning({
      id: TICKER_ID,
      symbol: "XYZ",
      name: "Example Corp",
    });

    const result = await getTickerForAgent(TICKER_ID, db, noProfiles);

    expect(result).toEqual({
      id: TICKER_ID,
      symbol: "XYZ",
      name: "Example Corp",
      aliases: [],
      sector: null,
      industry: null,
      subSector: null,
      subIndustry: null,
      businessActivity: null,
      peers: [],
    });
  });
});
