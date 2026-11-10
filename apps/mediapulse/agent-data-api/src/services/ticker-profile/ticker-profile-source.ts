import type { Prisma } from "@mediapulse/database";
import type {
  TickerProfileCommodity,
  TickerProfileRegulation,
} from "@workspace/agent-data-api-contract";

export type TickerProfileRecord = {
  companyOverview: string;
  businessOperation: string;
  companyOverviewIndonesian: string;
  businessOperationIndonesian: string;
  sectorIndonesian: string;
  sectorEnglish: string;
  subSectorIndonesian: string;
  subSectorEnglish: string;
  industryIndonesian: string;
  industryEnglish: string;
  subIndustryIndonesian: string;
  subIndustryEnglish: string;
  aliases: string[];
  names: string[];
  brands: string[];
  subsidiaries: string[];
  ambiguousNames: string[];
  competitors: Prisma.JsonValue;
  regulators: Prisma.JsonValue;
  commodities: TickerProfileCommodity[];
  regulations: TickerProfileRegulation[];
};

export type TickerProfileSource = (
  symbols: readonly string[],
) => Promise<ReadonlyMap<string, TickerProfileRecord>>;

export const normalizeTickerSymbol = (symbol: string): string =>
  symbol.trim().toUpperCase();

export const uniqueTickerSymbols = (symbols: Iterable<string>): string[] => {
  const unique = new Set<string>();
  for (const symbol of symbols) {
    const normalized = normalizeTickerSymbol(symbol);
    if (normalized !== "") {
      unique.add(normalized);
    }
  }

  return [...unique];
};

export const pickTickerProfiles = (
  profiles: ReadonlyMap<string, TickerProfileRecord>,
  symbols: readonly string[],
): Map<string, TickerProfileRecord> => {
  const picked = new Map<string, TickerProfileRecord>();
  for (const symbol of symbols) {
    const profile = profiles.get(normalizeTickerSymbol(symbol));
    if (profile !== undefined) {
      picked.set(symbol, profile);
    }
  }

  return picked;
};

export const keyProfilesBySymbol = (
  profiles: Iterable<[string, TickerProfileRecord]>,
): Map<string, TickerProfileRecord> => {
  const keyed = new Map<string, TickerProfileRecord>();
  for (const [symbol, profile] of profiles) {
    keyed.set(normalizeTickerSymbol(symbol), profile);
  }

  return keyed;
};

export const createInMemoryTickerProfileSource = (
  profiles: ReadonlyMap<string, TickerProfileRecord>,
): TickerProfileSource => {
  const keyed = keyProfilesBySymbol(profiles);

  return async (symbols) => pickTickerProfiles(keyed, symbols);
};
