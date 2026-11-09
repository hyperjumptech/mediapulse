import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({ prisma: {} }));

import { createDatabaseTickerProfileSource } from "./database-ticker-profile-source.js";
import {
  createInMemoryTickerProfileSource,
  tickerProfileRecordSelect,
  type TickerProfileRecord,
} from "./ticker-profile-source.js";

const profile: TickerProfileRecord = {
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
  aliases: ["MAPB"],
  competitors: [{ name: "Kopi Kenangan", aliases: [] }],
  regulators: [{ name: "OJK", aliases: [] }],
};

describe("createDatabaseTickerProfileSource", () => {
  it("reads the requested symbols in one query and keys them as requested", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ ...profile, ticker: { symbol: "MAPB" } }]);
    const source = createDatabaseTickerProfileSource({
      tickerProfile: { findMany },
    });

    const profiles = await source(["MAPB", " MAPB ", "FORE"]);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { ticker: { symbol: { in: ["MAPB", "FORE"] } } },
      select: {
        ...tickerProfileRecordSelect,
        ticker: { select: { symbol: true } },
      },
    });
    expect(profiles.get("MAPB")).toEqual(profile);
    expect(profiles.has("FORE")).toBe(false);
  });

  it("makes no query for an empty list", async () => {
    const findMany = vi.fn();
    const source = createDatabaseTickerProfileSource({
      tickerProfile: { findMany },
    });

    const profiles = await source([]);

    expect(profiles.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("createInMemoryTickerProfileSource", () => {
  it("looks symbols up ignoring case and returns them keyed as requested", async () => {
    const source = createInMemoryTickerProfileSource(
      new Map([["mapb", profile]]),
    );

    const profiles = await source(["MAPB", "FORE"]);

    expect([...profiles.keys()]).toEqual(["MAPB"]);
  });
});
