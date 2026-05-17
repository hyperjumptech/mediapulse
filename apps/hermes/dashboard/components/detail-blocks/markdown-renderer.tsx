import type { ReactNode } from "react";

/** Inline node parsed from a single line of markdown body text. */
type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "bold"; children: InlineNode[] }
  | { kind: "italic"; children: InlineNode[] }
  | { kind: "link"; href: string; text: string };

/**
 * Parses an inline string into a list of `text`, `bold`, `italic`, and `link` nodes.
 *
 * Supports:
 * - `[label](https://url)` inline links (only http/https URLs)
 * - `**bold**`
 * - `*italic*` (and `_italic_`)
 *
 * Bold inside link text is unwrapped to plain text per the contract spec (see #463).
 *
 * @param line - One line of markdown text.
 * @returns A flat list of inline nodes (no nested arrays at the top level).
 */
export function parseInlineMarkdown(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...parseEmphasis(line.slice(lastIndex, match.index)));
    }
    const label = match[1] ?? "";
    const href = match[2] ?? "";
    if (isSafeHref(href)) {
      nodes.push({ kind: "link", href, text: stripEmphasis(label) });
    } else {
      nodes.push({ kind: "text", value: match[0] ?? "" });
    }
    lastIndex = match.index + (match[0]?.length ?? 0);
  }
  if (lastIndex < line.length) {
    nodes.push(...parseEmphasis(line.slice(lastIndex)));
  }
  return nodes;
}

const isSafeHref = (href: string): boolean => {
  if (href.startsWith("/")) return true;
  return /^https?:\/\//i.test(href);
};

const stripEmphasis = (text: string): string =>
  text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/[*_]([^*_]+)[*_]/g, "$1");

const parseEmphasis = (text: string): InlineNode[] => {
  const nodes: InlineNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    const value = match[0] ?? "";
    if (value.startsWith("**")) {
      nodes.push({
        kind: "bold",
        children: [{ kind: "text", value: value.slice(2, -2) }],
      });
    } else {
      nodes.push({
        kind: "italic",
        children: [{ kind: "text", value: value.slice(1, -1) }],
      });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return nodes;
};

/** A parsed block of markdown body. */
export type MarkdownBlock =
  | { kind: "heading"; level: 1 | 2 | 3; children: InlineNode[] }
  | { kind: "paragraph"; children: InlineNode[] }
  | {
      kind: "list";
      ordered: boolean;
      items: Array<{ children: InlineNode[] }>;
    };

/**
 * Parses a markdown body into a list of paragraph / heading / list blocks.
 * Intentionally minimal — handles the subset used in newsletter bodies.
 *
 * @param body - Full markdown text.
 * @returns Parsed blocks ready to render.
 */
export function parseMarkdownBody(body: string): MarkdownBlock[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      i += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = (heading[1]?.length ?? 1) as 1 | 2 | 3;
      const text = heading[2] ?? "";
      blocks.push({
        kind: "heading",
        level,
        children: parseInlineMarkdown(text),
      });
      i += 1;
      continue;
    }
    const bulletMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    const orderedMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (bulletMatch || orderedMatch) {
      const ordered = orderedMatch !== null;
      const items: Array<{ children: InlineNode[] }> = [];
      while (i < lines.length) {
        const current = (lines[i] ?? "").trim();
        const matchBullet = /^[-*]\s+(.+)$/.exec(current);
        const matchOrdered = /^\d+\.\s+(.+)$/.exec(current);
        if (ordered && matchOrdered) {
          items.push({
            children: parseInlineMarkdown(matchOrdered[1] ?? ""),
          });
          i += 1;
          continue;
        }
        if (!ordered && matchBullet) {
          items.push({
            children: parseInlineMarkdown(matchBullet[1] ?? ""),
          });
          i += 1;
          continue;
        }
        break;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i] ?? "";
      const currentTrim = current.trim();
      if (currentTrim.length === 0) break;
      if (/^(#{1,3})\s+/.test(currentTrim)) break;
      if (/^[-*]\s+/.test(currentTrim)) break;
      if (/^\d+\.\s+/.test(currentTrim)) break;
      paragraphLines.push(currentTrim);
      i += 1;
    }
    blocks.push({
      kind: "paragraph",
      children: parseInlineMarkdown(paragraphLines.join(" ")),
    });
  }
  return blocks;
}

/**
 * Renders a list of inline nodes as React children. External links open in a
 * new tab with `rel="noopener noreferrer"`.
 *
 * @param nodes - Parsed inline nodes.
 * @param keyPrefix - Stable key prefix for React children.
 * @returns React elements/strings interleaved.
 */
export function renderInlineNodes(
  nodes: InlineNode[],
  keyPrefix: string,
): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.kind === "text") return node.value;
    if (node.kind === "bold") {
      return <strong key={key}>{renderInlineNodes(node.children, key)}</strong>;
    }
    if (node.kind === "italic") {
      return <em key={key}>{renderInlineNodes(node.children, key)}</em>;
    }
    const external = /^https?:\/\//i.test(node.href);
    return (
      <a
        key={key}
        href={node.href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="text-primary underline underline-offset-4"
      >
        {node.text}
      </a>
    );
  });
}
