/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { parseSeedProfile } from "./seed-tickers-local";

const localized = (id: string, en: string) => ({ id, en });

const validRow = {
  symbol: "AADI",
  name: "Adaro Andalan Indonesia",
  aliases: ["AADI", "Adaro"],
  company_overview: "Thermal coal producer.",
  business_operation: "Mines and sells thermal coal.",
  sector: localized("Energi", "Energy"),
  sub_sector: localized("Batu Bara", "Coal"),
  industry: localized("Batu Bara Termal", "Thermal Coal"),
  sub_industry: localized("Penambangan", "Thermal Coal Mining"),
  competitors: [{ name: "Bukit Asam", aliases: ["PTBA"] }],
  regulators: [{ name: "ESDM", aliases: [] }],
};

describe("parseSeedProfile", () => {
  it("parses a complete row", () => {
    const parsed = parseSeedProfile(validRow);

    expect(parsed?.symbol).toBe("AADI");
    expect(parsed?.sector).toEqual({ id: "Energi", en: "Energy" });
    expect(parsed?.competitors[0]?.name).toBe("Bukit Asam");
  });

  it("rejects a row with no symbol or name", () => {
    expect(parseSeedProfile({ ...validRow, symbol: "" })).toBeNull();
    expect(parseSeedProfile({ ...validRow, name: undefined })).toBeNull();
  });

  it("rejects a row whose classification is not localized", () => {
    expect(parseSeedProfile({ ...validRow, sector: "Energy" })).toBeNull();
    expect(
      parseSeedProfile({ ...validRow, sub_industry: { id: "only" } }),
    ).toBeNull();
  });

  it("rejects a non-object row", () => {
    expect(parseSeedProfile(null)).toBeNull();
    expect(parseSeedProfile("AADI")).toBeNull();
  });

  it("defaults the optional text and list fields", () => {
    const parsed = parseSeedProfile({
      symbol: "AADI",
      name: "Adaro",
      sector: localized("Energi", "Energy"),
      sub_sector: localized("Batu Bara", "Coal"),
      industry: localized("Termal", "Thermal"),
      sub_industry: localized("Tambang", "Mining"),
    });

    expect(parsed?.aliases).toEqual([]);
    expect(parsed?.competitors).toEqual([]);
    expect(parsed?.company_overview).toBe("");
  });

  it("drops malformed entries inside competitors and aliases", () => {
    const parsed = parseSeedProfile({
      ...validRow,
      aliases: ["AADI", 42, null],
      competitors: [{ name: "Ok", aliases: ["X", 1] }, { aliases: [] }, "bad"],
    });

    expect(parsed?.aliases).toEqual(["AADI"]);
    expect(parsed?.competitors).toEqual([{ name: "Ok", aliases: ["X"] }]);
  });
});
