import { getDomain, getDomainWithoutSuffix, parse } from "tldts";

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
  "umum",
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

const MAX_SITE_NAME_WORDS = 5;

const MIN_BRAND_FRAGMENT_CHARS = 4;

const LEGAL_ENTITY_PATTERN = /^(pt|cv)\b\.?\s|\btbk\.?$/i;

const SPACED_SEPARATOR_PATTERN = /\s+[|\-–—:]\s+|:\s+/;

const BARE_HYPHEN_TAGLINE_PATTERN = /^(\S{3,})-(\S+\s.*)$/;

const DOMAIN_LIKE_PATTERN = /\.[a-z]{2,}$/i;

const IGNORED_SUBDOMAIN_LABELS = new Set(["www", "m", "amp", "mobile"]);

const hostnameWhenUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return value;
  }

  const hostname = parse(trimmed).hostname ?? "";

  return hostname.replace(/^www\./, "");
};

const splitTagline = (name: string): string[] => {
  const spacedSegments = name
    .split(SPACED_SEPARATOR_PATTERN)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (spacedSegments.length > 1) {
    return spacedSegments;
  }

  const hyphenMatch = BARE_HYPHEN_TAGLINE_PATTERN.exec(name);
  const head = hyphenMatch?.[1];
  const tail = hyphenMatch?.[2];
  if (head === undefined || tail === undefined) {
    return [name];
  }

  return [head, tail.trim()];
};

const overlapsBrand = (name: string, brand: string): boolean => {
  const normalizedName = normalizeForComparison(name);
  if (normalizedName.includes(brand)) {
    return true;
  }

  return (
    normalizedName.length >= MIN_BRAND_FRAGMENT_CHARS &&
    brand.includes(normalizedName)
  );
};

const namesAnotherDomain = (name: string, pageDomain: string): boolean => {
  if (!DOMAIN_LIKE_PATTERN.test(name)) {
    return false;
  }

  const namedDomain = getDomain(name);

  return namedDomain !== null && namedDomain !== pageDomain;
};

const namesPageSubdomain = (
  name: string,
  subdomain: string | null,
): boolean => {
  const normalizedName = normalizeForComparison(name);
  const labels = (subdomain ?? "")
    .split(".")
    .filter(
      (label) => label.length > 0 && !IGNORED_SUBDOMAIN_LABELS.has(label),
    );

  return labels.some(
    (label) => normalizeForComparison(label) === normalizedName,
  );
};

export const publisherNameFromSiteMetadata = (
  value: string | undefined | null,
  pageUrl: string,
): string => {
  const unwrapped = typeof value === "string" ? hostnameWhenUrl(value) : value;
  const name = sanitizePublisherDisplayName(unwrapped);
  if (name.length === 0) {
    return "";
  }

  const page = parse(pageUrl);
  const brand = normalizeForComparison(page.domainWithoutSuffix ?? "");
  if (page.domain === null || brand.length === 0) {
    return name;
  }

  const segments = splitTagline(name);
  const candidate =
    segments.length > 1
      ? segments.find((segment) => overlapsBrand(segment, brand))
      : name;
  if (candidate === undefined || LEGAL_ENTITY_PATTERN.test(candidate)) {
    return "";
  }
  if (overlapsBrand(candidate, brand)) {
    return candidate;
  }
  if (namesAnotherDomain(candidate, page.domain)) {
    return "";
  }
  if (namesPageSubdomain(candidate, page.subdomain)) {
    return "";
  }

  const wordCount = candidate.split(/\s+/).length;

  return wordCount > MAX_SITE_NAME_WORDS ? "" : candidate;
};
