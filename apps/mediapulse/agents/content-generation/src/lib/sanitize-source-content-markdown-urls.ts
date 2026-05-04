/**
 * Markdown link/image pattern: optional `!`, bracket label, then parenthesized target.
 * Does not handle nested `]` inside labels (rare in scraped snippets).
 */
const MARKDOWN_LINK_OR_IMAGE = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;

/**
 * Raw disallowed schemes often left in HTML-to-markdown conversion (blob pages,
 * data URIs, script handlers).
 */
/** Match through the next whitespace so `javascript:alert(1)` is removed in full. */
const RAW_DISALLOWED_SCHEME =
  /\b(?:blob|data|javascript|mailto|tel|file):[^\s]+/gi;

/**
 * Returns true when `raw` is an absolute `http`/`https` URL whose host is suitable
 * for article-style citations (excludes localhost, loopback, and `.local` hosts).
 *
 * @param raw - URL string from a markdown link target (trimmed by caller).
 * @returns Whether the URL is kept in sanitized source content.
 */
const isPermittedArticleMarkdownTargetUrl = (raw: string): boolean => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return false;
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return false;
    }
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Removes non-article markdown link targets (blob, data, localhost, relative URLs,
 * etc.) from scraped source content so the LLM prompt only shows citable `http(s)`
 * links aligned with real article origins.
 *
 * - `![alt](blob:...)` becomes `alt` (or empty when alt is empty).
 * - `[text](bad)` becomes `text`.
 * - Permitted absolute `http(s)` links (non-loopback) are left unchanged.
 * - Standalone `blob:...`, `data:...`, `javascript:...`, etc. are stripped from the text.
 *
 * @param content - Raw markdown or HTML-ish snippet from a data source.
 * @returns Sanitized content safe to embed in the LLM context.
 */
export const sanitizeSourceContentMarkdownUrls = (content: string): string => {
  const withoutBadMarkdown = content.replace(
    MARKDOWN_LINK_OR_IMAGE,
    (full, bang: string, label: string, url: string) => {
      if (isPermittedArticleMarkdownTargetUrl(url)) {
        return full;
      }
      return label;
    },
  );
  return withoutBadMarkdown.replace(RAW_DISALLOWED_SCHEME, "");
};
