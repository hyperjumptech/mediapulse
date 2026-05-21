export type DomainTier = "tier_1" | "tier_2" | "tier_3";

const TIER_1_HOSTS = new Set([
  "reuters.com",
  "www.reuters.com",
  "bloomberg.com",
  "www.bloomberg.com",
  "ft.com",
  "www.ft.com",
  "wsj.com",
  "www.wsj.com",
  "cnbc.com",
  "www.cnbc.com",
  "kontan.co.id",
  "www.kontan.co.id",
  "bisnis.com",
  "www.bisnis.com",
  "kompas.com",
  "www.kompas.com",
  "detik.com",
  "www.detik.com",
]);

const TIER_2_HOSTS = new Set([
  "marketwatch.com",
  "www.marketwatch.com",
  "investor.id",
  "www.investor.id",
  "idxchannel.com",
  "www.idxchannel.com",
  "cnbcindonesia.com",
  "www.cnbcindonesia.com",
]);

const TIER_3_HOSTS = new Set([
  "medium.com",
  "www.medium.com",
  "businesswire.com",
  "www.businesswire.com",
  "prnewswire.com",
  "www.prnewswire.com",
]);

/**
 * Normalizes a URL hostname for reputation lookup.
 *
 * @param url - Full page URL.
 * @returns Lowercase hostname, or empty string when parsing fails.
 */
export const extractHostname = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

/**
 * Returns the editorial tier for a hostname.
 *
 * @param hostname - Lowercase hostname from {@link extractHostname}.
 */
export const domainTier = (hostname: string): DomainTier | null => {
  const normalized = hostname.toLowerCase();
  if (TIER_1_HOSTS.has(normalized)) {
    return "tier_1";
  }
  if (TIER_2_HOSTS.has(normalized)) {
    return "tier_2";
  }
  if (TIER_3_HOSTS.has(normalized)) {
    return "tier_3";
  }
  return null;
};

/**
 * Returns a numeric reputation score for ranking search hits.
 *
 * @param hostname - Lowercase hostname from {@link extractHostname}.
 * @returns `3` for tier 1, `2` for tier 2, `1` for tier 3, `0` for unknown hosts.
 */
export const reputationScore = (hostname: string): number => {
  const tier = domainTier(hostname);
  if (tier === "tier_1") {
    return 3;
  }
  if (tier === "tier_2") {
    return 2;
  }
  if (tier === "tier_3") {
    return 1;
  }
  return 0;
};
