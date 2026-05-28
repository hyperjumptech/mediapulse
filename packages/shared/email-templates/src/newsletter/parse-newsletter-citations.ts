import { parseNewsletterBody } from "./parse-newsletter-body.js";

/** A single citation extracted from a newsletter body. */
export interface NewsletterCitation {
  /** Display title (link text or top-news item title). */
  title: string;
  /** Absolute URL of the cited article. */
  url: string;
  /** Hostname (e.g. `example.com`), or empty string when the URL is unparsable. */
  domain: string;
}

/** Matches a markdown link `[title](url)`. Title may contain bold/italic markers. */
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/** Matches a `Read the full article: <url>` line anywhere in the body. */
const READ_FULL_ARTICLE_INLINE_REGEX =
  /Read the full article:\s*(https?:\/\/\S+)/gi;

/**
 * Removes surrounding bold/italic markers (`**`, `__`, `*`, `_`) from link text,
 * including a single nested layer. Returns the trimmed inner text.
 *
 * @param value - Raw link text captured between the `[]` of a markdown link.
 * @returns The cleaned title text.
 */
export const unwrapInlineFormatting = (value: string): string => {
  let current = value.trim();
  for (let step = 0; step < 4; step += 1) {
    const before = current;
    current = current.replace(/^\*\*(.+)\*\*$/s, "$1").trim();
    current = current.replace(/^__(.+)__$/s, "$1").trim();
    current = current.replace(/^\*(.+)\*$/s, "$1").trim();
    current = current.replace(/^_(.+)_$/s, "$1").trim();
    if (current === before) break;
  }
  return current;
};

/**
 * Extracts the hostname from a URL for the citations sub-table. Returns `""`
 * when the URL is unparsable (the parser never throws).
 *
 * @param url - Absolute URL (the regex only accepts `http(s)://…`).
 */
const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

/**
 * Builds a short citation title from plain multi-line text.
 *
 * @param text - Body text before any `Read the full article` line was stripped.
 * @returns First line, trimmed and capped for table display.
 */
const citationTitleFromPlainText = (text: string): string => {
  const first = text.trim().split("\n")[0]?.trim() ?? "";
  const base = first.length > 0 ? first : text.trim();
  if (base.length === 0) {
    return text.trim();
  }
  return base.length > 120 ? `${base.slice(0, 117)}...` : base;
};

/**
 * Extracts a deduplicated list of citations from a newsletter body.
 *
 * Sources, in document order:
 *
 * 1. Inline `[title](url)` markdown links (with bold/italic unwrapped).
 * 2. `Read the full article: <url>` lines, paired with structured titles from
 *    {@link parseNewsletterBody} when available (legacy top news, industry v2
 *    bullets and quick hits, optional extras), or the URL itself otherwise.
 *
 * The result deduplicates by URL, preserving the first occurrence. The function
 * never throws — malformed markdown yields fewer citations rather than an error.
 *
 * @param body - Newsletter content string.
 * @returns Ordered, deduplicated citations.
 */
export const parseNewsletterCitations = (
  body: string,
): NewsletterCitation[] => {
  if (typeof body !== "string" || body.length === 0) return [];

  const parsed = parseNewsletterBody(body);
  const titleByUrl = new Map<string, string>();
  if (parsed?.format === "legacy") {
    for (const item of parsed.topNewsItems) {
      if (item.url && !titleByUrl.has(item.url)) {
        titleByUrl.set(item.url, item.title);
      }
    }
  } else if (parsed?.format === "industry") {
    for (const section of parsed.sections) {
      if (section.machineKey === "quick-hits") {
        for (const hit of section.items) {
          if (hit.url && !titleByUrl.has(hit.url)) {
            titleByUrl.set(hit.url, citationTitleFromPlainText(hit.text));
          }
        }
      } else if ("bullets" in section) {
        for (const bullet of section.bullets) {
          if (bullet.url && !titleByUrl.has(bullet.url)) {
            titleByUrl.set(bullet.url, citationTitleFromPlainText(bullet.text));
          }
        }
      }
    }
  }

  const seen = new Set<string>();
  const citations: NewsletterCitation[] = [];

  const markdownMatches = [...body.matchAll(MARKDOWN_LINK_REGEX)];
  for (const match of markdownMatches) {
    const rawTitle = match[1] ?? "";
    const url = match[2] ?? "";
    if (url.length === 0 || seen.has(url)) continue;
    const title = unwrapInlineFormatting(rawTitle) || url;
    seen.add(url);
    citations.push({ title, url, domain: extractDomain(url) });
  }

  const articleLinkMatches = [...body.matchAll(READ_FULL_ARTICLE_INLINE_REGEX)];
  for (const match of articleLinkMatches) {
    const url = match[1] ?? "";
    if (url.length === 0 || seen.has(url)) continue;
    const title = titleByUrl.get(url) ?? url;
    seen.add(url);
    citations.push({ title, url, domain: extractDomain(url) });
  }

  return citations;
};
