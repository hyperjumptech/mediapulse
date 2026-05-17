const TRACKING_QUERY_PARAM_PREFIXES = [
  "utm_",
  "fbclid",
  "gclid",
  "mc_",
] as const;

const BLOCKED_HOST_PATTERNS = [
  /(^|\.)linkedin\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)reddit\.com$/i,
  /(^|\.)matrixbcg\.com$/i,
  /(^|\.)portersfiveforce\.com$/i,
] as const;

/**
 * Host + path pairs for ticker hubs and scrapers where `/news/` is still a feed, not a story.
 * Evaluated before article-path overrides.
 */
const NON_ARTICLE_HUB_HOST_PATH_PATTERNS = [
  {
    host: /^(?:[a-z0-9-]+\.)*finance\.yahoo\.com$/i,
    path: /^\/quote\//i,
  },
  { host: /(^|\.)investing\.com$/i, path: /^\/equities\//i },
  {
    host: /(^|\.)markets\.ft\.com$/i,
    path: /^\/data\/equities\/tearsheet\//i,
  },
  { host: /(^|\.)marketwatch\.com$/i, path: /^\/investing\/stock\//i },
  { host: /(^|\.)simplywall\.st$/i, path: /^\/stocks\//i },
  { host: /(^|\.)tradingview\.com$/i, path: /^\/symbols\//i },
  {
    host: /(^|\.)reuters\.com$/i,
    path: /^\/(markets\/companies|company)\//i,
  },
  { host: /(^|\.)cnbc\.com$/i, path: /^\/quotes?\//i },
  { host: /(^|\.)msn\.com$/i, path: /\/stockdetails\//i },
  {
    host: /(^|\.)bloomberg\.com$/i,
    path: /^\/(profile|quote)(\/|$)/i,
  },
  { host: /(^|\.)seekingalpha\.com$/i, path: /^\/symbol\//i },
  { host: /(^|\.)morningstar\.com$/i, path: /^\/(etfs|stocks)\//i },
  { host: /(^|\.)marketbeat\.com$/i, path: /^\/stocks\//i },
  { host: /(^|\.)gurufocus\.com$/i, path: /^\/stock\//i },
  {
    host: /(^|\.)stockanalysis\.com$/i,
    path: /^\/(stock|etf)\//i,
  },
  { host: /(^|\.)fintel\.io$/i, path: /^\/s\//i },
  { host: /(^|\.)sectors\.app$/i, path: /^\/idx\//i },
  { host: /(^|\.)pluang\.com$/i, path: /^\/en\/asset\//i },
  { host: /(^|\.)perplexity\.ai$/i, path: /^\/finance\//i },
  { host: /(^|\.)quartr\.com$/i, path: /^\/companies\//i },
  {
    host: /(^|\.)marketscreener\.com$/i,
    path: /\/finances(\/|$)/i,
  },
  {
    host: /(^|\.)scribd\.com$/i,
    path: /^\/document\//i,
  },
  {
    host: /(^|\.)researchgate\.net$/i,
    path: /^\/publication\//i,
  },
  {
    host: /(^|\.)idnfinancials\.com$/i,
    path: /^\/[a-z0-9]+\/[^/]+$/i,
  },
  {
    host: /(^|\.)tradingeconomics\.com$/i,
    path: /^\/[a-z0-9:%.-]+\/?$/i,
  },
  {
    host: /(^|\.)marketchameleon\.com$/i,
    path: /^\/Overview\//i,
  },
] as const;

const LIKELY_ARTICLE_PATH_PATTERNS = [
  /\/news\//i,
  /\/read\/\d+\//i,
  /\/news-releases\//i,
  /\/press-release\/[^/]+/i,
  /\/articles\//i,
  /\/article\/(?!equity\/data)[^/]+\//i,
] as const;

const BLOCKED_EXTENSION_PATTERNS = [/\.(pdf|xml)(\/|$)/i] as const;

const BLOCKED_PATH_PATTERNS = [
  /\/category\//i,
  /\/tag\//i,
  /\/topic\//i,
  /\/topics\//i,
  /\/search(\/|$)/i,
  /\/newslist(\/|$)/i,
  /\/news-key-events(\/|$)/i,
  /\/news-publications(\/|$)/i,
  /\/company-profile(\/|$)/i,
  /\/management(\/|$)/i,
  /\/financials(\/|$)/i,
  /\/key-statistics(\/|$)/i,
  /\/history(\/|$)/i,
  /\/forecast(\/|$)/i,
  /\/ownership(\/|$)/i,
  /\/consensus(\/|$)/i,
  /\/calendar(\/|$)/i,
  /\/company-governance(\/|$)/i,
  /\/historical-data(\/|$)/i,
  /\/performance(\/|$)/i,
  /\/documents(\/|$)/i,
  /\/investor-relations\/?$/i,
  /\/press-release\/?$/i,
  /\/investor\/?$/i,
  /\/company(\/|$)/i,
] as const;

export type UrlNoiseReason =
  | "blocked_host"
  | "blocked_host_path"
  | "blocked_path"
  | "blocked_extension";

export type UrlNoiseDecision =
  | { blocked: true; reason: UrlNoiseReason; canonicalUrl: string }
  | { blocked: false; canonicalUrl: string };

/**
 * Returns a normalized URL string used by dedupe and filtering.
 *
 * @param rawUrl - Candidate URL.
 * @returns Canonical URL with normalized host/path and stripped tracking query params.
 * @throws When `rawUrl` is not a valid absolute URL.
 */
export const canonicalizeUrl = (rawUrl: string): string => {
  const parsed = new URL(rawUrl);
  parsed.hash = "";
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  const keptParams = new URLSearchParams();
  for (const [key, value] of parsed.searchParams.entries()) {
    const isTracking = TRACKING_QUERY_PARAM_PREFIXES.some((prefix) =>
      key.toLowerCase().startsWith(prefix),
    );
    if (!isTracking) {
      keptParams.append(key, value);
    }
  }
  parsed.search = keptParams.toString();

  const normalizedPathname = parsed.pathname.replace(/\/{2,}/g, "/");
  parsed.pathname =
    normalizedPathname.length > 1
      ? normalizedPathname.replace(/\/+$/g, "")
      : normalizedPathname;

  if (parsed.pathname === "/" && parsed.search === "") {
    return `${parsed.protocol}//${parsed.hostname}`;
  }

  return parsed.toString();
};

/**
 * Returns true when the pathname matches a high-precision article-shaped path.
 *
 * @param pathname - URL pathname (no query or hash).
 * @returns True when the path should bypass generic non-article path rules.
 */
const pathnameMatchesArticleOverride = (pathname: string): boolean =>
  LIKELY_ARTICLE_PATH_PATTERNS.some((pattern) => pattern.test(pathname));

/**
 * Evaluates whether a URL should be blocked as a known non-article source for
 * data-collection and article-analysis prefilters.
 *
 * @param rawUrl - Candidate URL from search, fetch, or stored data source.
 * @returns Decision containing canonical URL and optional block reason.
 */
export const classifyNoisyUrl = (rawUrl: string): UrlNoiseDecision => {
  let canonicalUrl: string;
  try {
    canonicalUrl = canonicalizeUrl(rawUrl);
  } catch {
    return { blocked: true, reason: "blocked_path", canonicalUrl: rawUrl };
  }

  const parsed = new URL(canonicalUrl);
  const hostname = parsed.hostname;
  const pathname = parsed.pathname;

  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return { blocked: true, reason: "blocked_host", canonicalUrl };
  }

  if (
    NON_ARTICLE_HUB_HOST_PATH_PATTERNS.some(
      (rule) => rule.host.test(hostname) && rule.path.test(pathname),
    )
  ) {
    return { blocked: true, reason: "blocked_host_path", canonicalUrl };
  }

  if (pathnameMatchesArticleOverride(pathname)) {
    return { blocked: false, canonicalUrl };
  }

  if (BLOCKED_EXTENSION_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { blocked: true, reason: "blocked_extension", canonicalUrl };
  }

  if (BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { blocked: true, reason: "blocked_path", canonicalUrl };
  }

  return { blocked: false, canonicalUrl };
};
