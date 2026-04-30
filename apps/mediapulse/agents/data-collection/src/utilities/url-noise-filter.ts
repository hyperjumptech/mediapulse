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
] as const;

const BLOCKED_HOST_PATH_PATTERNS = [
  { host: /(^|\.)finance\.yahoo\.com$/i, path: /^\/quote\//i },
  { host: /(^|\.)investing\.com$/i, path: /^\/equities\//i },
  { host: /(^|\.)markets\.ft\.com$/i, path: /^\/data\/equities\/tearsheet\//i },
  { host: /(^|\.)marketwatch\.com$/i, path: /^\/investing\/stock\//i },
  { host: /(^|\.)simplywall\.st$/i, path: /^\/stocks\//i },
  { host: /(^|\.)tradingview\.com$/i, path: /^\/symbols\//i },
] as const;

const BLOCKED_PATH_PATTERNS = [
  /\/category\//i,
  /\/tag\//i,
  /\/topic\//i,
  /\/topics\//i,
  /\/search(\/|$)/i,
  /\/newslist(\/|$)/i,
  /\/news-key-events(\/|$)/i,
  /\/news-publications(\/|$)/i,
  /\/quote(\/|$)/i,
  /\/company(\/|$)/i,
  /\/company-profile(\/|$)/i,
  /\/management(\/|$)/i,
  /\/financials(\/|$)/i,
  /\/key-statistics(\/|$)/i,
  /\/history(\/|$)/i,
  /\/forecast(\/|$)/i,
  /\/ownership(\/|$)/i,
  /\/consensus(\/|$)/i,
  /\/calendar(\/|$)/i,
  /\/press-release(\/|$)/i,
  /\/investor-relations(\/|$)/i,
  /\/investor(\/|$)/i,
] as const;

const BLOCKED_EXTENSION_PATTERNS = [/\.(pdf|xml)(\/|$)/i] as const;

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
 * Evaluates whether a URL should be blocked as a known non-article source.
 *
 * @param rawUrl - Candidate URL from search or fetch stage.
 * @returns Decision containing canonical URL and optional block reason.
 */
export const classifyNoisyUrl = (rawUrl: string): UrlNoiseDecision => {
  const canonicalUrl = canonicalizeUrl(rawUrl);
  const parsed = new URL(canonicalUrl);
  const hostname = parsed.hostname;
  const pathname = parsed.pathname;

  const isReutersArticlePath =
    /(^|\.)reuters\.com$/i.test(hostname) &&
    !/^\/(markets\/companies|company)\//i.test(pathname);
  if (isReutersArticlePath) {
    return { blocked: false, canonicalUrl };
  }

  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return { blocked: true, reason: "blocked_host", canonicalUrl };
  }

  if (
    BLOCKED_HOST_PATH_PATTERNS.some(
      (rule) => rule.host.test(hostname) && rule.path.test(pathname),
    )
  ) {
    return { blocked: true, reason: "blocked_host_path", canonicalUrl };
  }

  if (BLOCKED_EXTENSION_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { blocked: true, reason: "blocked_extension", canonicalUrl };
  }

  if (BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { blocked: true, reason: "blocked_path", canonicalUrl };
  }

  return { blocked: false, canonicalUrl };
};
