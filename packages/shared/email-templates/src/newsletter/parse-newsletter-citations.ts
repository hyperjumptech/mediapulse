import { parseNewsletterBody } from "./parse-newsletter-body.js";

/** A single citation extracted from a newsletter body. */
export interface NewsletterCitation {
  /** Display title (article title, or link text for a non-document body). */
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
 * A valid newsletter document cites structurally, one citation per article in document
 * order. Any other body is scanned for inline `[title](url)` markdown links and
 * `Read the full article: <url>` lines.
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

  const document = parseNewsletterBody(body);

  // A document carries its citations structurally, so they are read straight off the
  // articles. Scanning the serialized body for links would find none, and would mistake
  // JSON punctuation for markdown.
  if (document !== undefined) {
    const seenUrls = new Set<string>();
    const documentCitations: NewsletterCitation[] = [];
    for (const section of document.sections) {
      for (const article of section.articles) {
        if (seenUrls.has(article.url)) {
          continue;
        }
        seenUrls.add(article.url);
        documentCitations.push({
          title: citationTitleFromPlainText(article.title),
          url: article.url,
          domain: extractDomain(article.url),
        });
      }
    }

    return documentCitations;
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
    const title = url;
    seen.add(url);
    citations.push({ title, url, domain: extractDomain(url) });
  }

  return citations;
};
