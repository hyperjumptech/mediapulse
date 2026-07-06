import type { Prisma } from "@mediapulse/database";

/** Maximum sector/industry peers returned in ticker peer context. */
export const QUERY_ANALYSIS_PEER_LIMIT = 5;

type TickerMetadataRecord = Record<string, unknown>;

/** Trims a nullable classification column value to a non-empty string, or `undefined`. */
const normalizeColumn = (
  value: string | null | undefined,
): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Normalizes sector and industry labels from a ticker's structured columns.
 *
 * @param ticker - Ticker row exposing `sector`/`industry` columns.
 * @returns Sector/industry strings when present.
 */
export const extractTickerSectorIndustry = (ticker: {
  sector?: string | null;
  industry?: string | null;
}): { sector?: string; industry?: string } => ({
  sector: normalizeColumn(ticker.sector),
  industry: normalizeColumn(ticker.industry),
});

/**
 * Normalizes sub-sector, sub-industry, and main business activity from a ticker's columns.
 *
 * @param ticker - Ticker row exposing the sub-classification columns.
 * @returns Sub-classification labels when present.
 */
export const extractTickerBusinessContext = (ticker: {
  subSector?: string | null;
  subIndustry?: string | null;
  businessActivity?: string | null;
}): {
  subSector?: string;
  subIndustry?: string;
  businessActivity?: string;
} => ({
  subSector: normalizeColumn(ticker.subSector),
  subIndustry: normalizeColumn(ticker.subIndustry),
  businessActivity: normalizeColumn(ticker.businessActivity),
});

/**
 * Parses market-cap style numeric metadata for peer ordering.
 *
 * - Important: Market cap is not populated on `metadataRaw` in practice, so this returns `null`
 *   for real rows today and peer market-cap ordering is effectively a no-op (peers fall back to
 *   id ordering). The parse is retained so a future `metadataRaw` market-cap field would order peers.
 *
 * @param metadataRaw - Ticker `metadataRaw` JSON blob (admin/import only).
 * @returns Numeric market cap, or `null` when unavailable.
 */
export const extractMarketCap = (metadataRaw: unknown): number | null => {
  if (
    !metadataRaw ||
    typeof metadataRaw !== "object" ||
    Array.isArray(metadataRaw)
  ) {
    return null;
  }
  const record = metadataRaw as TickerMetadataRecord;
  for (const key of ["marketCap", "MarketCap", "market_cap"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

/**
 * Builds Prisma `OR` filters for sector/industry peer lookup on the structured columns.
 *
 * @param sector - Sector label from the anchor ticker.
 * @param industry - Industry label from the anchor ticker.
 * @returns Prisma-compatible OR clauses, or `undefined` when both are absent.
 */
export const buildPeerColumnFilters = (
  sector: string | undefined,
  industry: string | undefined,
): Prisma.TickerWhereInput[] | undefined => {
  const filters: Prisma.TickerWhereInput[] = [];
  if (sector) {
    filters.push({ sector: { equals: sector } });
  }
  if (industry) {
    filters.push({ industry: { equals: industry } });
  }
  return filters.length > 0 ? filters : undefined;
};

/**
 * Sorts peer ticker rows by market cap descending, then id ascending.
 *
 * @param peers - Candidate peer rows with a `metadataRaw` blob.
 * @returns Sorted peers capped at {@link QUERY_ANALYSIS_PEER_LIMIT}.
 */
export const sortAndLimitPeers = <
  T extends { id: string; symbol: string; name: string; metadataRaw: unknown },
>(
  peers: T[],
): T[] =>
  [...peers]
    .sort((left, right) => {
      const leftCap = extractMarketCap(left.metadataRaw);
      const rightCap = extractMarketCap(right.metadataRaw);
      if (leftCap !== null && rightCap !== null) {
        return rightCap - leftCap;
      }
      if (leftCap !== null) {
        return -1;
      }
      if (rightCap !== null) {
        return 1;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, QUERY_ANALYSIS_PEER_LIMIT);
