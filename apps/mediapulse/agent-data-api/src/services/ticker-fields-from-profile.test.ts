import { describe, expect, it } from "vitest";

import { tickerFieldsFromProfile } from "./ticker-fields-from-profile.js";
import type { TickerProfileRecord } from "./ticker-profile/ticker-profile-source.js";

const profile: TickerProfileRecord = {
  companyOverview: "Coffee chain.",
  businessOperation: "  Runs app-first coffee shops.  ",
  sectorIndonesian: "Barang Konsumen Primer",
  sectorEnglish: "Consumer Non-Cyclicals",
  subSectorIndonesian: "Makanan & Minuman",
  subSectorEnglish: "Food & Beverage",
  industryIndonesian: "Jaringan Kedai Kopi",
  industryEnglish: "Coffee Shop Chain",
  subIndustryIndonesian: " ",
  subIndustryEnglish: "App-first Coffee",
  aliases: ["Fore Coffee", "fore coffee", "  ", "Fore"],
  competitors: [],
  regulators: [],
};

describe("tickerFieldsFromProfile", () => {
  it("uses the Indonesian classification and the business operation", () => {
    const fields = tickerFieldsFromProfile(profile);

    expect(fields).toEqual({
      aliases: ["Fore Coffee", "Fore"],
      sector: "Barang Konsumen Primer",
      industry: "Jaringan Kedai Kopi",
      subSector: "Makanan & Minuman",
      subIndustry: null,
      businessActivity: "Runs app-first coffee shops.",
    });
  });

  it("returns empty aliases and nulls without a profile", () => {
    const fields = tickerFieldsFromProfile(null);

    expect(fields).toEqual({
      aliases: [],
      sector: null,
      industry: null,
      subSector: null,
      subIndustry: null,
      businessActivity: null,
    });
  });
});
