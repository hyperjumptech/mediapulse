import type { TickerProfileRecord } from "./ticker-profile/ticker-profile-source.js";

export type TickerFieldsFromProfile = {
  aliases: string[];
  sector: string | null;
  industry: string | null;
  subSector: string | null;
  subIndustry: string | null;
  businessActivity: string | null;
};

const textOrNull = (value: string): string | null => {
  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
};

const uniqueAliases = (aliases: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const alias of aliases) {
    const trimmed = alias.trim();
    const normalized = trimmed.toLowerCase();
    if (trimmed === "" || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(trimmed);
  }

  return unique;
};

export const tickerFieldsFromProfile = (
  profile: TickerProfileRecord | null,
): TickerFieldsFromProfile => {
  if (profile === null) {
    return {
      aliases: [],
      sector: null,
      industry: null,
      subSector: null,
      subIndustry: null,
      businessActivity: null,
    };
  }

  return {
    aliases: uniqueAliases(profile.aliases),
    sector: textOrNull(profile.sectorIndonesian),
    industry: textOrNull(profile.industryIndonesian),
    subSector: textOrNull(profile.subSectorIndonesian),
    subIndustry: textOrNull(profile.subIndustryIndonesian),
    businessActivity: textOrNull(profile.businessOperation),
  };
};
