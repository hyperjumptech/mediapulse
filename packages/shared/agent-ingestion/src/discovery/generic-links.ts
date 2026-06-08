import { classifyNoisyUrl } from "@workspace/utils";

import { classifyError } from "../error-classification";
import type {
  DiscoveredItem,
  DiscoveryDeps,
  ListingDiscoveryStrategy,
} from "./types";

/** Regex to extract href attribute values from anchor tags. */
const HREF_REGEX = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

/**
 * Extracts all href values from raw HTML.
 *
 * @param html - Raw HTML string.
 */
const extractHrefs = (html: string): string[] => {
  const hrefs: string[] = [];
  let match: RegExpExecArray | null;
  HREF_REGEX.lastIndex = 0;

  while ((match = HREF_REGEX.exec(html)) !== null) {
    const href = match[1];
    if (href) {
      hrefs.push(href);
    }
  }

  return hrefs;
};

/**
 * Resolves a potentially relative href against the listing page origin.
 *
 * @param href - Raw href from an anchor tag.
 * @param baseUrl - The listing page URL used as base for relative hrefs.
 */
const resolveHref = (href: string, baseUrl: string): string | undefined => {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return undefined;
  }
};

/**
 * Returns true when the resolved URL is on the same host as the listing page.
 *
 * @param resolvedUrl - Fully resolved URL.
 * @param listingHost - Hostname of the listing page.
 */
const isSameHost = (resolvedUrl: string, listingHost: string): boolean => {
  try {
    return new URL(resolvedUrl).hostname === listingHost;
  } catch {
    return false;
  }
};

/**
 * Fetches a listing page and extracts same-host article links via classifyNoisyUrl.
 *
 * @param listingUrl - URL of the listing page.
 * @param deps - Shared discovery dependencies.
 */
const discoverGenericLinks = async (
  listingUrl: string,
  deps: DiscoveryDeps,
): Promise<DiscoveredItem[]> => {
  const { gotClient, rateLimiter, timeoutMs } = deps;

  await rateLimiter.acquire();

  let html: string;
  let listingHost: string;
  try {
    listingHost = new URL(listingUrl).hostname;
  } catch {
    throw Object.assign(new Error(`Invalid listing URL: ${listingUrl}`), {
      errorCategory: "internal_processing_error",
    });
  }

  try {
    const response = await gotClient.get(listingUrl, {
      headers: { Accept: "text/html" },
      ...(timeoutMs ? { timeout: { request: timeoutMs } } : {}),
    });
    rateLimiter.recordResponse(response.statusCode);
    html = response.body;
  } catch (error) {
    const classified = classifyError(error);
    throw Object.assign(new Error(classified.message), {
      errorCategory: classified.category,
    });
  }

  const hrefs = extractHrefs(html);
  const seen = new Set<string>();
  const items: DiscoveredItem[] = [];

  for (const href of hrefs) {
    const resolved = resolveHref(href, listingUrl);
    if (!resolved) {
      continue;
    }
    if (!isSameHost(resolved, listingHost)) {
      continue;
    }

    const decision = classifyNoisyUrl(resolved);
    if (decision.blocked) {
      continue;
    }

    const canonical = decision.canonicalUrl;
    if (seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);

    items.push({ url: canonical });
  }

  return items;
};

/** Generic same-host link extraction listing discovery strategy. */
export const genericLinksStrategy: ListingDiscoveryStrategy = {
  type: "generic-links",
  discover: discoverGenericLinks,
};
