const TRACKING_QUERY_PARAM_PREFIXES = [
  "utm_",
  "fbclid",
  "gclid",
  "mc_",
] as const;

const hostPattern = (domain: string): RegExp =>
  new RegExp(`(^|\\.)${domain.replace(/\./g, "\\.")}$`, "i");

const BLOCKED_HOST_DOMAINS = [
  "linkedin.com",
  "youtube.com",
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "reddit.com",
  "matrixbcg.com",
  "portersfiveforce.com",
  "sch.id",
  "msn.com",
  "vietnam.vn",
  "achmadnurhidayat.id",
  "qoo10.co.id",
] as const;

const BLOCKED_HOST_PATTERNS = BLOCKED_HOST_DOMAINS.map(hostPattern);

/**
 * Statistics portals and market-research report mills. These publish static, often paywalled or
 * consent-walled data pages ("market size to hit USD X by 20YY", key-statistics dashboards), never
 * dated news, so they are blocked host-wide regardless of path. Kept separate from
 * {@link BLOCKED_HOST_DOMAINS} so the drop reason distinguishes low-value data pages from social
 * and scraper hosts.
 */
const LOW_VALUE_SOURCE_DOMAINS = [
  "statista.com",
  "precedenceresearch.com",
  "grandviewresearch.com",
  "marketsandmarkets.com",
  "mordorintelligence.com",
  "fortunebusinessinsights.com",
  "imarcgroup.com",
  "alliedmarketresearch.com",
  "researchandmarkets.com",
  "marketresearchfuture.com",
  "futuremarketinsights.com",
  "verifiedmarketresearch.com",
  // Encyclopedias and wikis: reference material, never reporting. Their articles
  // routinely mention an industry in passing, so relevance gating cannot catch them.
  "wikipedia.org",
  "wikimedia.org",
  "wiktionary.org",
  "wikiwand.com",
  "fandom.com",
  "britannica.com",
  "tradingview.com",
  "journalarta.com",
  "zoominfo.com",
  "tracxn.com",
  "dealroom.co",
  // Workforce-data vendors: scraped headcount and org-chart pages keyed by company name. They
  // match an issuer perfectly and report nothing. One headlined a SOHO issue as though the
  // company had disclosed its own employee count.
  "reveliolabs.com",
  "theorg.com",
  "growjo.com",
] as const;

const LOW_VALUE_SOURCE_HOST_PATTERNS =
  LOW_VALUE_SOURCE_DOMAINS.map(hostPattern);

/**
 * Bare domains blocked host-wide regardless of path: social and scraper hosts plus statistics
 * portals, market-research mills, and encyclopedias. Feeds search-provider `excludeDomains` params
 * so these are dropped before results come back, mirroring the post-search host checks in
 * {@link classifyNoisyUrl}. Path-conditional hub hosts are excluded because they include legitimate
 * news domains.
 */
export const HOST_WIDE_BLOCKED_DOMAINS: readonly string[] = [
  ...BLOCKED_HOST_DOMAINS,
  ...LOW_VALUE_SOURCE_DOMAINS,
];

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
  { host: /(^|\.)simplywall\.st$/i, path: /^\/stocks?\//i },
  {
    host: /(^|\.)reuters\.com$/i,
    path: /^\/(markets\/companies|company)\//i,
  },
  { host: /(^|\.)cnbc\.com$/i, path: /^\/quotes?\//i },
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
  { host: /(^|\.)ajaib\.co\.id$/i, path: /^\/saham\/aset\//i },
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
    path: /^\/(publication|figure)\//i,
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
  /\/rubrik\//i,
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
  /\/company-profiles(\/|$)/i,
  /\/price-prediction(\/|$)/i,
  /\/stock-prediction(\/|$)/i,
  /\/price-forecast(\/|$)/i,
  /\/stock-forecast(\/|$)/i,
  /\/price-target(\/|$)/i,
] as const;

/** Terminal path segments that mark a section index rather than an article. */
const HOMEPAGE_PATH_SEGMENTS = new Set([
  "home",
  "index",
  "beranda",
  "main",
  "landing",
  "news",
  "berita",
  "artikel",
  "articles",
  "blog",
  "press",
  "media",
  "insights",
  "updates",
  "press-releases",
  "pressreleases",
  "newsroom",
  "siaran-pers",
  "feature",
  "features",
  "rubrik",
  "kanal",
]);

const LOCALE_ONLY_SEGMENT = /^[a-z]{2}(?:[-_][a-z]{2})?$/i;

/**
 * Generated tool and reference pages. These match ticker terms perfectly (they are
 * built from ticker symbols) yet contain no reporting, so relevance gating cannot
 * catch them.
 */
const NON_ARTICLE_PAGE_PATTERNS = [
  /\/compare(\/|$)/i,
  /\/profiles?(\/|$)/i,
  /\/(dividends|dividend)(\/|$)/i,
  /\/(quote|quotes)(\/|$)/i,
  /\/(chart|charts)(\/|$)/i,
  /\/(screener|watchlist)(\/|$)/i,
  /\/market-data(\/|$)/i,
  /\/research-ratings(\/|$)/i,
  /\/(financials|earnings|estimates|valuation)(\/|$)/i,
  /\/(key-ratios|balance-sheet|cash-flow|income-statement)(\/|$)/i,
  /\/products?(\/|$)/i,
  /\/page\/[a-z0-9-]*\d+$/i,
  /\/(technologies|technology|solutions|platforms?)(\/|$)/i,
  /\/[a-z]+-companies(\/|$)/i,
  /\/[a-z0-9-]{16,}\/\d{1,3}$/i,
  /\/(?:berita-)?foto(?:-berita)?(\/|$)/i,
  /\/galer(?:i|y|ies)(\/|$)/i,
  /\/(?:photo|photos|photo-news|gallery|galleries)(\/|$)/i,
  /\/images?(\/|$)/i,
] as const;

/**
 * Job listings and other classified content that a publisher files under its news section.
 *
 * Checked before {@link LIKELY_ARTICLE_PATH_PATTERNS}, unlike every other path rule: a recruitment
 * listing served from `/news/` is still a recruitment listing, and the article-shaped override
 * would otherwise wave it through. Both examples that reached subscribers did exactly that.
 */
const NON_EDITORIAL_PATH_PATTERNS = [
  /\/lowongan(?:-kerja)?(?:[/-]|$)/i,
  /(?:^|[/-])loker(?:[/-]|$)/i,
  /\/kari[er]r?(\/|$)/i,
  /\/careers?(\/|$)/i,
  /[/-]job-(?:vacanc|opening|listing)/i,
  /[/-]rekrutmen(?:[/-]|$)/i,
] as const;

/**
 * Interstitials that stand in front of a publisher's article. When the target URL is carried in a
 * query parameter it is unwrapped and the wrapper disappears; when the parameter holds an opaque
 * token (Google's `goto?url=CAES...` protobuf blob) nothing is recoverable, so the candidate is
 * dropped. Keeping one would ship a tracking blob as the reader's link and the wrapper's host as
 * the publisher byline.
 */
const REDIRECT_WRAPPER_RULES = [
  { host: /^(?:[a-z0-9-]+\.)*google\.[a-z.]+$/i, path: /^\/(url|goto)$/i },
  { host: /^(?:[a-z0-9-]+\.)*facebook\.com$/i, path: /^\/l\.php$/i },
  { host: /^(?:[a-z0-9-]+\.)*t\.umblr\.com$/i, path: /^\/redirect$/i },
  { host: /^out\.reddit\.com$/i, path: /^\/$/i },
] as const;

/** Query parameters a wrapper uses to carry the destination URL. */
const REDIRECT_TARGET_PARAMS = ["url", "u", "q", "target", "to"] as const;

/**
 * Aggregator links whose article id encodes the destination in a form nothing here can decode.
 *
 * - Important: these are deliberately not blocked host-wide. page-collection ingests Google News
 *   feed items and attributes them to the publisher the feed names, which is worth keeping. Only
 *   the link is unusable, so the check belongs where a URL becomes a reader-facing link.
 */
const UNRESOLVABLE_AGGREGATOR_RULES = [
  { host: /^news\.google\.[a-z.]+$/i, path: /^\/(rss\/)?articles\//i },
] as const;

/**
 * Reports whether a URL is an aggregator link that will not resolve to an article for a reader.
 *
 * @param rawUrl - Candidate URL.
 * @returns True when the link would reach an aggregator shell rather than the article.
 */
export const isUnresolvableAggregatorUrl = (rawUrl: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  return UNRESOLVABLE_AGGREGATOR_RULES.some(
    (rule) =>
      rule.host.test(parsed.hostname) && rule.path.test(parsed.pathname),
  );
};

export type UrlNoiseReason =
  | "blocked_host"
  | "low_value_source"
  | "blocked_host_path"
  | "blocked_path"
  | "blocked_extension"
  | "site_homepage"
  | "non_article_page"
  | "non_editorial_page"
  | "opaque_redirect";

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
const PAGINATING_ARTICLE_HOSTS: readonly { host: RegExp; path: RegExp }[] = [
  { host: /(^|\.)bisnis\.com$/iu, path: /^\/read\//iu },
  { host: /(^|\.)kontan\.co\.id$/iu, path: /^\/news\//iu },
];

const PAGINATION_SEGMENT_PATTERN = /\/(?:all|\d{1,3})$/iu;

export const stripPaginationSegment = (
  hostname: string,
  pathname: string,
): string => {
  const rule = PAGINATING_ARTICLE_HOSTS.find(
    (entry) => entry.host.test(hostname) && entry.path.test(pathname),
  );
  if (rule === undefined) {
    return pathname;
  }
  const stripped = pathname.replace(PAGINATION_SEGMENT_PATTERN, "");

  return stripped.length > 1 ? stripped : pathname;
};

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
  const trimmedPathname =
    normalizedPathname.length > 1
      ? normalizedPathname.replace(/\/+$/g, "")
      : normalizedPathname;
  parsed.pathname = stripPaginationSegment(parsed.hostname, trimmedPathname);

  if (parsed.pathname === "/" && parsed.search === "") {
    return `${parsed.protocol}//${parsed.hostname}`;
  }

  return parsed.toString();
};

/**
 * Unwraps a redirect interstitial to the publisher URL it points at.
 *
 * @param rawUrl - Candidate URL, canonical or not.
 * @returns The destination URL when the wrapper carries a recoverable one, `"opaque"` when it is a
 *   wrapper whose target cannot be recovered, or `undefined` when the URL is not a wrapper.
 */
export const unwrapRedirectUrl = (
  rawUrl: string,
): string | "opaque" | undefined => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return undefined;
  }

  const isWrapper = REDIRECT_WRAPPER_RULES.some(
    (rule) =>
      rule.host.test(parsed.hostname) && rule.path.test(parsed.pathname),
  );
  if (!isWrapper) {
    return undefined;
  }

  for (const param of REDIRECT_TARGET_PARAMS) {
    const value = parsed.searchParams.get(param);
    if (value === null || value.trim().length === 0) {
      continue;
    }
    try {
      const target = new URL(value);
      if (target.protocol === "http:" || target.protocol === "https:") {
        return target.toString();
      }
    } catch {
      continue;
    }
  }

  return "opaque";
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
 * Returns true when the pathname addresses a site or section homepage rather than
 * a single story: a bare domain, or a path whose last segment is an index name.
 *
 * @param pathname - URL pathname (no query or hash).
 */
const pathnameIsHomepage = (pathname: string): boolean => {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return true;
  }

  if (segments.every((segment) => LOCALE_ONLY_SEGMENT.test(segment))) {
    return true;
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment === undefined) {
    return true;
  }

  return HOMEPAGE_PATH_SEGMENTS.has(lastSegment.toLowerCase());
};

/**
 * Evaluates whether a URL should be blocked as a known non-article source for
 * data-collection and article-analysis prefilters.
 *
 * @param rawUrl - Candidate URL from search, fetch, or stored data source.
 * @returns Decision containing canonical URL and optional block reason.
 */
export const classifyNoisyUrl = (rawUrl: string): UrlNoiseDecision => {
  // Resolved before anything else so the publisher's own host, not the interstitial's, is what
  // every host and path rule below judges.
  const unwrapped = unwrapRedirectUrl(rawUrl);
  if (unwrapped === "opaque") {
    let canonicalWrapper: string;
    try {
      canonicalWrapper = canonicalizeUrl(rawUrl);
    } catch {
      canonicalWrapper = rawUrl;
    }

    return {
      blocked: true,
      reason: "opaque_redirect",
      canonicalUrl: canonicalWrapper,
    };
  }

  const targetUrl = unwrapped ?? rawUrl;

  let canonicalUrl: string;
  try {
    canonicalUrl = canonicalizeUrl(targetUrl);
  } catch {
    return { blocked: true, reason: "blocked_path", canonicalUrl: targetUrl };
  }

  const parsed = new URL(canonicalUrl);
  const hostname = parsed.hostname;
  const pathname = parsed.pathname;

  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return { blocked: true, reason: "blocked_host", canonicalUrl };
  }

  if (
    LOW_VALUE_SOURCE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
  ) {
    return { blocked: true, reason: "low_value_source", canonicalUrl };
  }

  if (
    NON_ARTICLE_HUB_HOST_PATH_PATTERNS.some(
      (rule) => rule.host.test(hostname) && rule.path.test(pathname),
    )
  ) {
    return { blocked: true, reason: "blocked_host_path", canonicalUrl };
  }

  // Checked before the article-shaped override: a homepage is never a story, no
  // matter which section name appears earlier in the path.
  if (pathnameIsHomepage(pathname)) {
    return { blocked: true, reason: "site_homepage", canonicalUrl };
  }

  // Ahead of the article-shaped override: publishers file recruitment listings under /news/, and
  // the override would otherwise treat the listing as a story.
  if (NON_EDITORIAL_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { blocked: true, reason: "non_editorial_page", canonicalUrl };
  }

  if (pathnameMatchesArticleOverride(pathname)) {
    return { blocked: false, canonicalUrl };
  }

  if (NON_ARTICLE_PAGE_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { blocked: true, reason: "non_article_page", canonicalUrl };
  }

  if (BLOCKED_EXTENSION_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { blocked: true, reason: "blocked_extension", canonicalUrl };
  }

  if (BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { blocked: true, reason: "blocked_path", canonicalUrl };
  }

  return { blocked: false, canonicalUrl };
};
