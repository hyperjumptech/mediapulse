import { XMLParser } from "fast-xml-parser";

import { classifyError } from "../error-classification";
import type {
  DiscoveredItem,
  DiscoveryDeps,
  ListingDiscoveryStrategy,
} from "./types";

const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (tagName: string) => tagName === "url",
} as const;

const xmlParser = new XMLParser(XML_PARSER_OPTIONS);

/**
 * Normalizes a raw date string to an ISO string, returning undefined when unparseable.
 *
 * @param raw - Raw date string from a sitemap field.
 */
const normalizeDate = (raw: unknown): string | undefined => {
  if (typeof raw !== "string" || raw.trim() === "") {
    return undefined;
  }
  const parsed = new Date(raw.trim());

  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

/**
 * Maps a string or object with #text to a plain string.
 *
 * @param value - Possibly wrapped text from the XML parser.
 */
const asText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value || undefined;
  }
  if (typeof value === "object" && value !== null && "#text" in value) {
    const text = (value as Record<string, unknown>)["#text"];
    return typeof text === "string" ? text || undefined : undefined;
  }
  return undefined;
};

/**
 * Parses a sitemap urlset into DiscoveredItem entries.
 *
 * @param doc - Parsed XML document.
 */
const parseSitemapUrls = (doc: Record<string, unknown>): DiscoveredItem[] => {
  const urlset = doc["urlset"] as Record<string, unknown> | undefined;
  if (!urlset) {
    return [];
  }

  const urls = (urlset["url"] as unknown[]) ?? [];

  return urls.flatMap((urlNode) => {
    const node = urlNode as Record<string, unknown>;
    const loc = asText(node["loc"]);
    if (!loc) {
      return [];
    }

    const newsNode = node["news:news"] as Record<string, unknown> | undefined;
    const newsTitle = newsNode
      ? asText((newsNode["news:title"] ?? newsNode["title"]) as unknown)
      : undefined;

    const rawDate =
      node["lastmod"] ??
      newsNode?.["news:publication_date"] ??
      newsNode?.["publication_date"];
    const publishedAt = normalizeDate(rawDate);

    return [
      {
        url: loc,
        ...(newsTitle ? { title: newsTitle } : {}),
        ...(publishedAt ? { publishedAt } : {}),
      },
    ];
  });
};

/**
 * Fetches and parses a sitemap (standard or news) into DiscoveredItem entries.
 *
 * @param listingUrl - URL of the sitemap.
 * @param deps - Shared discovery dependencies.
 */
const discoverSitemap = async (
  listingUrl: string,
  deps: DiscoveryDeps,
): Promise<DiscoveredItem[]> => {
  const { gotClient, rateLimiter } = deps;

  await rateLimiter.acquire();

  let body: string;
  try {
    const response = await gotClient.get(listingUrl, {
      headers: { Accept: "application/xml, text/xml" },
    });
    rateLimiter.recordResponse(response.statusCode);
    body = response.body;
  } catch (error) {
    const classified = classifyError(error);
    throw Object.assign(new Error(classified.message), {
      errorCategory: classified.category,
    });
  }

  let doc: Record<string, unknown>;
  try {
    doc = xmlParser.parse(body) as Record<string, unknown>;
  } catch (error) {
    throw Object.assign(
      new Error(
        `Sitemap XML parse failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
      { errorCategory: "provider_data_invalid" },
    );
  }

  if (!doc["urlset"]) {
    throw Object.assign(
      new Error("Not a recognized sitemap (missing <urlset>)"),
      { errorCategory: "provider_data_invalid" },
    );
  }

  return parseSitemapUrls(doc);
};

/** Sitemap listing discovery strategy. */
export const sitemapStrategy: ListingDiscoveryStrategy = {
  type: "sitemap",
  discover: discoverSitemap,
};
