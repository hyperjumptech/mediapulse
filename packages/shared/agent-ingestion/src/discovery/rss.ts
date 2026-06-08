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
  isArray: (tagName: string) => tagName === "item" || tagName === "entry",
} as const;

const xmlParser = new XMLParser(XML_PARSER_OPTIONS);

/**
 * Normalizes a raw date string to an ISO string, returning undefined when unparseable.
 *
 * @param raw - Raw date string from a feed field.
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
 * Parses RSS 2.0 items from a parsed feed document.
 *
 * @param doc - Parsed XML document.
 */
const parseRssItems = (doc: Record<string, unknown>): DiscoveredItem[] => {
  const channel = (doc["rss"] as Record<string, unknown>)?.["channel"] as
    | Record<string, unknown>
    | undefined;
  if (!channel) {
    return [];
  }

  const items = (channel["item"] as unknown[]) ?? [];

  return items.flatMap((item) => {
    const entry = item as Record<string, unknown>;
    const url = asText(entry["link"]);
    if (!url) {
      return [];
    }

    return [
      {
        url,
        ...(asText(entry["title"]) ? { title: asText(entry["title"]) } : {}),
        ...(asText(entry["description"])
          ? { summary: asText(entry["description"]) }
          : {}),
        ...(normalizeDate(entry["pubDate"])
          ? { publishedAt: normalizeDate(entry["pubDate"]) }
          : {}),
      },
    ];
  });
};

/**
 * Parses Atom feed entries from a parsed feed document.
 *
 * @param doc - Parsed XML document.
 */
const parseAtomEntries = (doc: Record<string, unknown>): DiscoveredItem[] => {
  const feed = doc["feed"] as Record<string, unknown> | undefined;
  if (!feed) {
    return [];
  }

  const entries = (feed["entry"] as unknown[]) ?? [];

  return entries.flatMap((entry) => {
    const node = entry as Record<string, unknown>;

    const linkNode = node["link"];
    let url: string | undefined;
    if (
      typeof linkNode === "object" &&
      linkNode !== null &&
      "@_href" in linkNode
    ) {
      url = (linkNode as Record<string, string>)["@_href"];
    } else if (Array.isArray(linkNode)) {
      const alternate = (linkNode as Record<string, string>[]).find(
        (link) => !link["@_rel"] || link["@_rel"] === "alternate",
      );
      url = alternate?.["@_href"];
    } else {
      url = asText(linkNode);
    }

    if (!url) {
      return [];
    }

    const summaryNode = node["summary"] ?? node["content"];

    return [
      {
        url,
        ...(asText(node["title"]) ? { title: asText(node["title"]) } : {}),
        ...(asText(summaryNode) ? { summary: asText(summaryNode) } : {}),
        ...(normalizeDate(node["updated"] ?? node["published"])
          ? { publishedAt: normalizeDate(node["updated"] ?? node["published"]) }
          : {}),
      },
    ];
  });
};

/**
 * Fetches and parses an RSS or Atom feed into DiscoveredItem entries.
 *
 * @param listingUrl - URL of the RSS or Atom feed.
 * @param deps - Shared discovery dependencies.
 */
const discoverRss = async (
  listingUrl: string,
  deps: DiscoveryDeps,
): Promise<DiscoveredItem[]> => {
  const { gotClient, rateLimiter } = deps;

  await rateLimiter.acquire();

  let body: string;
  try {
    const response = await gotClient.get(listingUrl, {
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
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
        `RSS/Atom XML parse failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
      { errorCategory: "provider_data_invalid" },
    );
  }

  if (doc["rss"]) {
    return parseRssItems(doc);
  }
  if (doc["feed"]) {
    return parseAtomEntries(doc);
  }

  throw Object.assign(new Error("Not a recognized RSS or Atom feed"), {
    errorCategory: "provider_data_invalid",
  });
};

/** RSS/Atom listing discovery strategy. */
export const rssStrategy: ListingDiscoveryStrategy = {
  type: "rss",
  discover: discoverRss,
};
