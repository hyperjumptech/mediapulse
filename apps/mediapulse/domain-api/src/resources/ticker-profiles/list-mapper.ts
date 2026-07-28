import type { Prisma, TickerProfile } from "@mediapulse/database";

type ProfileRow = TickerProfile & {
  ticker: { symbol: string; name: string };
};

const partyNames = (value: Prisma.JsonValue): string => {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((entry) => {
      if (entry === null || typeof entry !== "object") {
        return null;
      }
      const name = (entry as { name?: unknown }).name;

      return typeof name === "string" ? name : null;
    })
    .filter((name): name is string => name !== null)
    .join(", ");
};

export const mapRowToListItem = (row: ProfileRow) => ({
  id: row.id,
  symbol: row.ticker.symbol,
  name: row.ticker.name,
  companyOverview: row.companyOverview,
  businessOperation: row.businessOperation,
  sector: row.sectorEnglish,
  subSector: row.subSectorEnglish,
  industry: row.industryEnglish,
  subIndustry: row.subIndustryEnglish,
  sectorIndonesian: row.sectorIndonesian,
  subSectorIndonesian: row.subSectorIndonesian,
  industryIndonesian: row.industryIndonesian,
  subIndustryIndonesian: row.subIndustryIndonesian,
  aliases: row.aliases.join(", "),
  competitors: partyNames(row.competitors),
  regulators: partyNames(row.regulators),
  updatedAt: row.updatedAt.toISOString(),
});

export type ListItem = ReturnType<typeof mapRowToListItem>;
