import { Link } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

/** Predicate that returns true when a markdown link target is safe to render as `href`. */
export type IsAllowedNewsletterLinkUrl = (href: string) => boolean;

const MARKDOWN_LINK = /\[([^\]]+)]\(([^)]+)\)/g;

/**
 * Returns true when `href` is an absolute `https:` URL suitable for newsletter citations.
 *
 * @param href - Raw URL from markdown link parentheses (may include surrounding whitespace).
 * @returns Whether the trimmed value parses as `https:` with a host.
 */
export const defaultIsAllowedNewsletterLinkUrl = (href: string): boolean => {
  const trimmed = href.trim();
  if (!trimmed.toLowerCase().startsWith("https://")) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
};

export type RenderInlineMarkdownLinksDependencies = {
  /** Override URL policy (defaults to {@link defaultIsAllowedNewsletterLinkUrl}). */
  isAllowedUrl?: IsAllowedNewsletterLinkUrl;
};

/**
 * Turns inline markdown links `[label](url)` into React Email `Link` nodes; other text stays plain.
 * Only `https:` URLs accepted by `isAllowedUrl` become links; rejected patterns stay as the original substring.
 *
 * @param text - Paragraph or line that may contain markdown links.
 * @param linkStyle - CSS passed to each rendered `Link`.
 * @param dependencies - Optional injectables for tests.
 * @returns A string, a single element, or an array of mixed text and links suitable as `Text` children.
 */
export const renderInlineMarkdownLinks = (
  text: string,
  linkStyle: CSSProperties,
  dependencies: RenderInlineMarkdownLinksDependencies = {},
): ReactNode => {
  const isAllowedUrl =
    dependencies.isAllowedUrl ?? defaultIsAllowedNewsletterLinkUrl;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let linkKey = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(MARKDOWN_LINK.source, MARKDOWN_LINK.flags);
  while ((match = re.exec(text)) !== null) {
    const full = match[0] ?? "";
    const label = match[1] ?? "";
    const rawHref = match[2] ?? "";
    const start = match.index;

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    const href = rawHref.trim();
    if (label.length > 0 && isAllowedUrl(href)) {
      parts.push(
        <Link
          href={href}
          key={`newsletter-inline-link-${linkKey++}`}
          style={linkStyle}
        >
          {label}
        </Link>,
      );
    } else {
      parts.push(full);
    }

    lastIndex = start + full.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0] ?? "";
  }
  return parts;
};
