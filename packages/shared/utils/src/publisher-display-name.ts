import { getDomainWithoutSuffix } from "tldts";

const MAX_DISPLAY_NAME_CHARS = 80;

const GENERIC_SITE_NAMES = new Set([
  "home",
  "homepage",
  "beranda",
  "news",
  "berita",
  "article",
  "artikel",
  "index",
  "untitled",
  "google news",
  "amp",
]);

const normalizeForComparison = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Cleans a publisher name read from site metadata, returning `""` when the value is unusable.
 *
 * - Important: `og:site_name` is author-controlled and frequently carries a generic placeholder
 *   such as "Home" or a whole headline, so a rejected value must fall back rather than ship.
 *
 * @param value - Raw metadata value.
 * @returns The cleaned name, or `""` when it should not be used.
 */
export const sanitizePublisherDisplayName = (
  value: string | undefined | null,
): string => {
  if (typeof value !== "string") {
    return "";
  }

  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0 || collapsed.length > MAX_DISPLAY_NAME_CHARS) {
    return "";
  }
  if (GENERIC_SITE_NAMES.has(collapsed.toLowerCase())) {
    return "";
  }
  if (!/[a-z]/i.test(collapsed)) {
    return "";
  }

  return collapsed;
};

/**
 * Reports whether a display name is a spacing and casing rearrangement of a domain's brand token.
 *
 * - Important: This is the guard that makes an LLM-suggested name safe to store. A model that
 *   invents or expands a name fails the comparison and is rejected.
 *
 * @param displayName - Candidate publisher name.
 * @param domain - Registrable domain the name is claimed for.
 * @returns `true` when the name reduces to the domain's brand token.
 */
export const publisherNameMatchesDomain = (
  displayName: string,
  domain: string,
): boolean => {
  const brand = getDomainWithoutSuffix(domain);
  if (brand === null || brand.length === 0) {
    return false;
  }

  return normalizeForComparison(displayName) === normalizeForComparison(brand);
};
